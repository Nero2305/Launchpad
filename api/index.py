"""Stateless FastAPI entrypoint, shared by uvicorn and Vercel Functions."""
from collections import Counter
from datetime import date, timedelta
from enum import Enum
import os
from uuid import UUID

import httpx
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException, Response
from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator

load_dotenv('.env.local')
load_dotenv()
app = FastAPI(title='Launchpad API', version='1.0.0', docs_url='/api/docs', openapi_url='/api/openapi.json')


class Stage(str, Enum):
    saved = 'Saved'
    applied = 'Applied'
    interview = 'Interview'
    offer = 'Offer'
    closed = 'Closed'


class ApplicationInput(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    company: str = Field(min_length=1, max_length=100)
    role: str = Field(min_length=1, max_length=150)
    location: str = Field(default='', max_length=100)
    stage: Stage = Stage.saved
    applied_on: date | None = None
    follow_up: date | None = None
    interview_on: date | None = None
    url: HttpUrl | None = None
    notes: str = Field(default='', max_length=5000)

    @field_validator('applied_on')
    @classmethod
    def not_in_future(cls, value):
        if value and value > date.today():
            raise ValueError('Application date cannot be in the future')
        return value


class AnalyticsInput(BaseModel):
    applications: list[ApplicationInput] = Field(max_length=500)


def summarize(rows: list[ApplicationInput], today: date | None = None):
    """Current-state metrics, deliberately not inferred historical conversion rates."""
    today = today or date.today()
    counts = Counter(row.stage.value for row in rows)
    submitted = sum(row.stage != Stage.saved for row in rows)
    progressed = counts['Interview'] + counts['Offer']
    weeks = []
    monday = today - timedelta(days=today.weekday())
    for offset in range(5, -1, -1):
        start = monday - timedelta(weeks=offset)
        weeks.append({'week': start.isoformat(), 'count': sum(
            row.applied_on is not None and start <= row.applied_on < start + timedelta(days=7)
            for row in rows)})
    return {
        'total': len(rows), 'submitted': submitted,
        'active': counts['Applied'] + counts['Interview'],
        'interviews': counts['Interview'], 'offers': counts['Offer'],
        'progress_rate': round(progressed / submitted * 100) if submitted else 0,
        'follow_ups_due': sum(row.follow_up is not None and row.follow_up <= today
                             and row.stage not in (Stage.closed, Stage.offer) for row in rows),
        'stages': {stage.value: counts[stage.value] for stage in Stage}, 'weeks': weeks,
    }


@app.get('/api/health')
def health():
    return {'status': 'ok', 'service': 'launchpad', 'version': '1.0.0'}


@app.post('/api/analytics')
def analytics(payload: AnalyticsInput):
    return summarize(payload.applications)


async def identity(authorization: str | None = Header(default=None)):
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(401, 'Sign in to access your workspace')
    url = os.getenv('SUPABASE_URL', '').rstrip('/')
    key = os.getenv('SUPABASE_PUBLISHABLE_KEY', '')
    if not url or not key:
        raise HTTPException(503, 'Account storage is not configured; use demo mode')
    headers = {'apikey': key, 'Authorization': authorization}
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(f'{url}/auth/v1/user', headers=headers)
        if response.status_code in (401, 403):
            raise HTTPException(401, 'Session expired; sign in again')
        if response.status_code != 200:
            raise HTTPException(502, 'Authentication provider is unavailable')
        user_id = str(UUID(response.json()['id']))
    except (httpx.HTTPError, ValueError, KeyError):
        raise HTTPException(502, 'Authentication provider is unavailable')
    return {'url': url, 'headers': headers, 'user_id': user_id}


async def database(method, auth, *, record_id=None, payload=None):
    # Forward the USER token: Postgres RLS remains effective even if a filter is missed.
    params = {'user_id': f"eq.{auth['user_id']}"}
    if record_id is not None:
        params['id'] = f'eq.{record_id}'
    if method == 'GET':
        params.update({'order': 'created_at.desc', 'limit': '501'})
    headers = {**auth['headers'], 'Prefer': 'return=representation'}
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            result = await client.request(method, f"{auth['url']}/rest/v1/applications",
                                          headers=headers, params=params, json=payload)
    except httpx.HTTPError:
        raise HTTPException(502, 'Storage is unavailable; please try again')
    if result.status_code >= 400:
        raise HTTPException(502, 'Could not save or retrieve your applications')
    rows = result.json()
    if method == 'GET' and len(rows) > 500:
        raise HTTPException(409, 'Workspace exceeds the 500-record portfolio limit')
    if record_id and not rows:
        raise HTTPException(404, 'Application not found')
    return rows


@app.get('/api/applications')
async def list_applications(auth=Depends(identity)):
    return await database('GET', auth)


@app.post('/api/applications', status_code=201)
async def create_application(payload: ApplicationInput, auth=Depends(identity)):
    rows = await database('POST', auth, payload={**payload.model_dump(mode='json'), 'user_id': auth['user_id']})
    return rows[0]


@app.put('/api/applications/{record_id}')
async def update_application(record_id: UUID, payload: ApplicationInput, auth=Depends(identity)):
    rows = await database('PATCH', auth, record_id=record_id, payload=payload.model_dump(mode='json'))
    return rows[0]


@app.delete('/api/applications/{record_id}', status_code=204)
async def delete_application(record_id: UUID, auth=Depends(identity)):
    await database('DELETE', auth, record_id=record_id)
    return Response(status_code=204)


@app.middleware('http')
async def request_limits(request, call_next):
    # Vercel also applies platform request-size limits. Cap chunked bodies as well.
    if request.method in ('POST', 'PUT', 'PATCH'):
        size = 0
        async for chunk in request.stream():
            size += len(chunk)
            if size > 1_000_000:
                return Response('Request too large', status_code=413)
            # Request.body() caches content for downstream validation.
            request._body = getattr(request, '_body', b'') + chunk
    response = await call_next(request)
    response.headers['Cache-Control'] = 'no-store'
    response.headers['X-Content-Type-Options'] = 'nosniff'
    return response
