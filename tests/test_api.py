"""Behavior tests use mocked HTTP boundaries; no credentials or live database."""
from datetime import date, timedelta
from uuid import uuid4

import httpx
import pytest
from fastapi.testclient import TestClient
from api.index import app, ApplicationInput, summarize, identity

client = TestClient(app)


def item(**changes):
    return {'company': 'Orbit', 'role': 'Intern', **changes}


def test_health_and_no_store():
    response = client.get('/api/health')
    assert response.json()['status'] == 'ok'
    assert response.headers['cache-control'] == 'no-store'


def test_empty_analytics_is_zero_not_division_error():
    data = client.post('/api/analytics', json={'applications': []}).json()
    assert data['progress_rate'] == 0
    assert len(data['weeks']) == 6
    assert data['total'] == 0


def test_metrics_boundaries_and_closed_followup():
    today = date(2026, 10, 27)
    rows = [
        ApplicationInput(**item(stage='Applied', applied_on='2026-10-26', follow_up=today)),
        ApplicationInput(**item(stage='Interview', applied_on='2026-10-25')),
        ApplicationInput(**item(stage='Offer', follow_up=today)),
        ApplicationInput(**item(stage='Closed', follow_up=today)),
        ApplicationInput(**item(stage='Saved')),
    ]
    data = summarize(rows, today)
    assert data['submitted'] == 4
    assert data['active'] == 2
    assert data['progress_rate'] == 50
    assert data['follow_ups_due'] == 1
    assert data['weeks'][-1]['count'] == 1
    assert data['weeks'][-2]['count'] == 1


@pytest.mark.parametrize('changes', [
    {'company': '  '}, {'stage': 'Hired'}, {'url': 'javascript:alert(1)'},
    {'role': 'a' * 151}, {'user_id': str(uuid4())},
    {'applied_on': (date.today() + timedelta(days=1)).isoformat()},
])
def test_rejects_invalid_or_owner_injected_payload(changes):
    assert client.post('/api/analytics', json={'applications': [item(**changes)]}).status_code == 422


def test_bounded_analytics():
    assert client.post('/api/analytics', json={'applications': [item()] * 501}).status_code == 422
    assert client.post('/api/analytics', content='x' * 1_000_001).status_code == 413


@pytest.mark.parametrize('method,path', [('GET','/api/applications'), ('POST','/api/applications'), ('PUT',f'/api/applications/{uuid4()}'), ('DELETE',f'/api/applications/{uuid4()}')])
def test_mutations_and_reads_require_auth(method, path):
    assert client.request(method, path, json=item()).status_code == 401


def test_unconfigured_storage(monkeypatch):
    monkeypatch.delenv('SUPABASE_URL', raising=False)
    monkeypatch.delenv('SUPABASE_PUBLISHABLE_KEY', raising=False)
    assert client.get('/api/applications', headers={'Authorization':'Bearer fake'}).status_code == 503


@pytest.fixture
def mock_storage(monkeypatch):
    owner = str(uuid4())
    calls = []
    records = []
    async def auth():
        return {'url':'https://example.supabase.co', 'user_id':owner,
                'headers':{'apikey':'public', 'Authorization':'Bearer user-token'}}
    class FakeClient:
        def __init__(self, **kwargs): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *args): pass
        async def request(self, method, url, **kwargs):
            calls.append((method,url,kwargs))
            payload = kwargs.get('json')
            return httpx.Response(200, json=[{'id':str(uuid4()), **payload}] if payload else records)
    app.dependency_overrides[identity] = auth
    monkeypatch.setattr(httpx, 'AsyncClient', FakeClient)
    yield owner,calls,records
    app.dependency_overrides.clear()


def test_create_sets_owner_and_forwards_user_token(mock_storage):
    owner,calls,_ = mock_storage
    response = client.post('/api/applications', json=item())
    assert response.status_code == 201
    assert response.json()['user_id'] == owner
    assert calls[0][2]['headers']['Authorization'] == 'Bearer user-token'


def test_update_scopes_owner_and_record(mock_storage):
    owner,calls,_ = mock_storage
    record_id = str(uuid4())
    assert client.put(f'/api/applications/{record_id}', json=item(stage='Offer')).status_code == 200
    assert calls[0][0] == 'PATCH'
    assert calls[0][2]['params'] == {'user_id':f'eq.{owner}', 'id':f'eq.{record_id}'}


def test_missing_or_foreign_delete_is_404(mock_storage):
    assert client.delete(f'/api/applications/{uuid4()}').status_code == 404


def test_delete_success(mock_storage):
    _,_,records = mock_storage
    records.append({'id':str(uuid4())})
    response = client.delete(f'/api/applications/{records[0]["id"]}')
    assert response.status_code == 204
    assert response.content == b''


def test_storage_errors_do_not_leak_details(mock_storage, monkeypatch):
    async def fail(*args, **kwargs):
        return httpx.Response(500, json={'error':'secret implementation details'})
    monkeypatch.setattr(httpx.AsyncClient, 'request', fail)
    response = client.get('/api/applications')
    assert response.status_code == 502
    assert 'secret' not in response.text


def test_invalid_session_is_rejected(monkeypatch):
    monkeypatch.setenv('SUPABASE_URL','https://example.supabase.co')
    monkeypatch.setenv('SUPABASE_PUBLISHABLE_KEY','public')
    class FakeAuth:
        def __init__(self, **kwargs): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *args): pass
        async def get(self, *args, **kwargs): return httpx.Response(401)
    monkeypatch.setattr(httpx,'AsyncClient',FakeAuth)
    assert client.get('/api/applications',headers={'Authorization':'Bearer invalid'}).status_code == 401
