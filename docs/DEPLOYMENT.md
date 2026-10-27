# From source code to a public portfolio

## 1. Start locally

Follow the README's OS-specific installation steps. `npm run dev:full` starts two services. Do not skip the Python dependency installation: the UI can load without Python, but analytics and account CRUD will not work.

The project uses a Vite proxy in development and a Vercel rewrite in production. Both keep API calls under the same origin, so permissive cross-origin API settings are unnecessary.

## 2. Put it on GitHub

Create an empty repository named `launchpad` on GitHub. From the extracted project folder:

```bash
git init
git add .
git status
# Check that no .env.local, node_modules, .venv, or private records appear.
git commit -m "Build Launchpad internship workspace"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/launchpad.git
git push -u origin main
```

Replace `YOUR_USERNAME`. The commands are instructions, not evidence that this repository has been published. Use GitHub's normal authenticated flow; never commit access tokens. If the repository already has history, clone it and copy project files into it instead of overwriting that history.

Suggested repository description:

> A fullstack internship application workspace with Python/FastAPI, React, TypeScript, PostgreSQL, and Vercel deployment.

Suggested topics: `python`, `fastapi`, `react`, `typescript`, `supabase`, `postgresql`, `vercel`, `internship-tracker`.

## 3. Choose deployment mode

**Public demo:** no Supabase setup. Anyone can explore fictional examples, edit their own browser-local copy, and use Python analytics. This is the fastest recruiter demo. No visitor can alter another visitor's local workspace.

**Accounts:** run the SQL migration and configure Supabase Auth before adding the four environment variables. Account CRUD uses the backend; account records start empty. Keep the Supabase publishable key in both key variables, never a service-role key.

## 4. Import into Vercel

- Root: the folder containing `package.json` and `api/`.
- Framework: Vite.
- Install: `npm ci`.
- Build: `npm run build`.
- Output: `dist`.
- Python version: 3.12 via `.python-version`.
- Environment variables: absent for demo, all four set for accounts.

The root `requirements.txt` is for the Python Function. `requirements-dev.txt` is for local tests/CI only. The frontend and API do not need separate Vercel projects. `api/index.py` exports the ASGI `app` object.

Do not replace the API rewrite with a catch-all SPA rewrite that sends `/api` to `index.html`. The application uses in-page navigation, so it does not need arbitrary client-side path fallbacks.

## Release smoke test

Run these checks against the **deployed** URL; local tests cannot validate Vercel routing or your live RLS installation.

- [ ] `/api/health` returns JSON, not HTML or a 404.
- [ ] `/api/docs` loads and points at `/api/openapi.json`.
- [ ] Demo dashboard metrics load from Python without an offline banner.
- [ ] Add, edit, stage-change, delete, filter, and CSV export work.
- [ ] Reload preserves demo records; reset restores examples.
- [ ] Narrow mobile layout, keyboard navigation and dialog Escape behave correctly.
- [ ] If enabling accounts, signup confirmation returns to your deployed origin.
- [ ] Account A can create/update a row and see it after signing in again.
- [ ] Account B's workspace starts empty and does not show A's row.
- [ ] Using B's token, PUT/DELETE with A's record UUID return 404.
- [ ] Through Supabase REST, B's token cannot SELECT/UPDATE/DELETE A's row, nor INSERT a row with A's `user_id`.
- [ ] Signing out returns to the separate local demo and clears cloud records from the UI.
- [ ] No secrets/private data are committed. CI is green.

The second-account direct REST checks matter: proving an API filter works is not the same as proving database RLS works. Use test records and your own accounts. Never paste real access tokens into public issue reports.

## Troubleshooting

| Symptom                            | Check                                                                                      |
| ---------------------------------- | ------------------------------------------------------------------------------------------ |
| Analytics offline locally          | Install Python dependencies; use `npm run dev:full`, not just `vite` or `npm run preview`  |
| `spawn python ENOENT`              | Create `.venv` at project root, or set `PYTHON` to a valid interpreter                     |
| Port 8000 already in use           | Stop the other backend process, then restart development                                   |
| API URL returns frontend HTML      | Root directory and API rewrite; ensure `api/index.py` is deployed                          |
| Python function not detected       | Root `requirements.txt`, `.python-version`, `api/index.py`, and current Vercel Python docs |
| Sign-in explains demo mode         | Frontend environment variables were absent at build time; set them and redeploy            |
| Storage not configured             | Set both backend Supabase variables in the deployment environment                          |
| Generic storage error              | Check Supabase logs, table creation, column names, policies and matching project URLs      |
| Confirmation redirects incorrectly | Correct Supabase Auth Site URL and allowed redirect URLs                                   |
| No signup email                    | Check spam, Supabase email limits, and configured SMTP provider                            |
| Empty interview page               | Stage must be Interview and interview date must be today or later                          |
| Activity count is lower than total | Saved/undated records and dates outside the six-week window are excluded                   |

## Hosting costs and operational boundaries

No LLM API key is needed. Vercel and Supabase each have their own pricing, quotas, and acceptable-use rules; check the current plan details rather than assuming hosting is permanently free. Configure budget alerts and rate controls appropriate to your public traffic.

There is no background daemon, cron task, or email scheduler. All work happens during requests. Supabase is the durable database; Vercel's function filesystem is never used for application storage.
