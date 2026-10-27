# Engineering walkthrough

This guide is for a student who wants to understand, modify, and confidently discuss the project.

## Read the code in this order

1. **`src/model.ts`** — the `Application` type describes one opportunity. `Input` excludes server-owned fields. Demo seed, search and CSV helpers are small pure functions except for ID/date generation.
2. **`api/index.py`** — read `ApplicationInput`, `summarize`, then the routes. Pydantic converts/validates incoming JSON before route logic executes.
3. **`src/api.ts`** — one HTTP boundary handles JSON, status codes, access tokens and errors. Components do not need to reimplement fetch handling.
4. **`src/components/ApplicationEditor.tsx`** — controlled inputs build an `Input`, then pass it to the parent save callback.
5. **`src/App.tsx`** — session state chooses demo vs cloud storage. Mutations update one source of truth; analytics reruns when records change.
6. **`supabase/schema.sql`** — ownership is enforced independently at the database boundary.
7. **Tests** — each test states a behavior the application promises.

## What Python actually does

Python is not a decorative dependency. It validates the editable record schema, verifies identity for persistent operations, applies owner filters, communicates with Postgres through Supabase REST, normalizes service errors, and calculates dashboard aggregates.

The analytics function is deliberately separated from request handling. You can call `summarize(rows, today=...)` with a fixed date in a test. That makes week boundaries and due-date behavior deterministic without changing the computer clock.

Complexity: filtering/counting is linear in the number of applications. The six-week calculation scans the list six times; six is a constant, so complexity remains O(n). With a 500-record analytics cap this is easy to understand and appropriate. At larger scale, aggregate in SQL and return paginated records rather than loading the entire dataset into a browser.

## Why PostgreSQL through HTTP?

A conventional Python app can use SQLAlchemy and a Postgres connection pool. This project instead uses Supabase's REST interface because it forwards the logged-in user's token into row-level security and avoids maintaining raw database connections across serverless invocations.

The tradeoff is reliance on Supabase's API semantics and an extra network hop. Keep that access in the `database` function so a future repository layer can replace it.

## Authentication is not authorization

Authentication asks **who is making the request?** `identity` verifies the bearer token by asking Supabase Auth for the user. It does not merely decode an unverified JWT.

Authorization asks **which records can that user access?** The API adds `user_id=eq.<verified-user>` and the record UUID to queries. PostgreSQL also checks `auth.uid() = user_id` through RLS. Both INSERT and UPDATE have `WITH CHECK` policies to prevent transferring a record to another owner.

A publishable key identifies the project; it does not grant unrestricted data access. An elevated service-role key would defeat this protection and is not needed here.

## Demo design

The demo has no shared public write table. Each visitor has their own local records, and the interface discloses this. Public analytics is stateless: it calculates a result and forgets the request data. Demo sign-in does not silently merge example records into a real account.

The benefit is a low-friction recruiter walkthrough. The limitation is browser-only persistence and no cross-device demo sync.

## Honest analytics

A record's current status cannot tell you all the stages it visited. An application marked Closed may have had three interviews or none. Therefore this project calls its ratio a **current progression percentage**, not an interview conversion rate.

To support historical analytics, add an `application_events` table containing application ID, owner ID, old stage, new stage, and timestamp. Use a database transaction/trigger to capture each transition. Add RLS to that table and derive historical milestones from events.

Dates are calendar days rather than timestamps. Python uses the server date while browser follow-up cards use the user's local date. A stronger design would store a user's IANA timezone and derive "today" consistently; interview schedules would store a UTC timestamp plus a display timezone. Test daylight-saving boundaries before adding calendar export.

## Error handling and concurrency

The frontend waits for successful cloud writes before updating its stored record list. A failed save leaves the editor open and displays the error. Mutation buttons are disabled while saving. Fetch cancellation prevents an obsolete analytics result from replacing a newer one.

This is not a collaborative realtime system. If two devices update one application, the last successful write wins. A next iteration could add a version number and conditional update; a conflict would show the user both versions instead of silently overwriting.

## Security decisions

- Allow only HTTP(S) links and do not server-fetch arbitrary URLs.
- Render notes as text, not HTML.
- Reject owner fields and unknown input fields in Pydantic.
- Forward user tokens so database RLS stays active.
- Neutralize spreadsheet formula prefixes in exported text.
- Bound analytics work and JSON body size.
- Do not return upstream database error details or cache private responses.

A production service would additionally need operational monitoring, appropriate public endpoint rate controls, tested backups/recovery, dependency review, and account lifecycle UX. The current release makes those limits explicit.

## Test boundaries

The backend suite uses `TestClient` for real FastAPI routing/validation and mocks only the outbound Supabase HTTP boundary. This proves request ownership parameters and error behavior, but cannot prove your live database policies exist. The two-account deployment smoke test fills that gap.

Frontend utility tests run without a browser. Manual browser review covers interactions and layout. Full automated browser tests against ephemeral infrastructure are a useful next addition, not an existing claim.

## Suggested interview demo

1. Explain the problem in one sentence.
2. Add a role, change its stage, add interview notes, and show the interview card.
3. Show the same-origin API call and Pydantic schema.
4. Explain owner verification and RLS.
5. Run the tests and discuss one negative case.
6. State one limitation and the concrete design you would use to improve it.

## Good next contributions

Pick a bounded issue and implement it yourself:

- Add `.ics` export with correct escaping and timezone tests.
- Extract the workspace state logic into a `useWorkspace` hook and dashboard sections into smaller components.
- Add account password recovery using Supabase's supported flow.
- Add PostgreSQL integration tests for ownership policies.
- Add optimistic concurrency with an `updated_at`/version check.

Explain where you used AI assistance, what you reviewed, and which changes you made. Understanding and extending the code is what makes a portfolio project useful in an interview.
