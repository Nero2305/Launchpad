# Verification record

Validated on 27 October 2026 in a Linux development environment. This file distinguishes observed checks from deployment steps the project owner must still perform.

| Check                                    | Result                                                                       |
| ---------------------------------------- | ---------------------------------------------------------------------------- |
| TypeScript and Vite production build     | Passed                                                                       |
| Vitest utility suite                     | 10 tests passed                                                              |
| Pytest API suite                         | 21 tests passed                                                              |
| `npm audit --omit=dev`                   | No reported vulnerabilities at time of check                                 |
| `pip-audit -r requirements.txt`          | No known vulnerabilities reported at time of check                           |
| Fresh Python virtual environment install | Passed with pinned direct dependencies                                       |
| Desktop UI visual review                 | Dashboard and editor inspected                                               |
| Browser create/search                    | Added a fictional QA record and found it with search                         |
| Browser editing/interviews               | Changed stage/date/notes and verified the upcoming interview card            |
| Browser persistence                      | Reloaded and verified the QA record remained                                 |
| Browser board transition                 | Changed Interview to Offer and verified saved form state                     |
| Browser delete/empty state               | Confirmed deletion of the QA record and saw no matching results              |
| CSV serialization                        | Tested quoting, newline handling and formula prefix neutralization in Vitest |

The Python suite emits a Starlette test-client deprecation warning for its HTTPX compatibility path. Tests pass; this is not a runtime application failure. Migrate the test harness when adopting its replacement client.

## Verification boundaries

- The managed browser preview supports the frontend, but its runtime could not start Python alongside it. Browser analytics therefore displayed the explicit unavailable state. Analytics/CRUD/auth boundary behavior was exercised through FastAPI's test client, not a live browser-to-Python preview connection.
- No Vercel account was connected and no deployment was created. `vercel.json` is prepared using the documented Python Function/rewrites pattern; verify the deployed routes using the release checklist.
- No Supabase project or credentials were supplied. Live signup/email, database persistence and actual RLS enforcement must be checked against a configured project using two test accounts. API tests mock outbound Supabase responses.
- Responsive CSS is implemented; physical-device/mobile browser, screen-reader and formal WCAG testing have not been performed.
- Dependency scans are point-in-time checks, not a security certification. Transitive Python dependencies are not fully locked.
- CSV download UI is implemented; browser download contents were not independently inspected beyond the utility tests.

See [DEPLOYMENT.md](DEPLOYMENT.md#release-smoke-test) for the remaining release checks. Do not change these entries to “passed” without running them.
