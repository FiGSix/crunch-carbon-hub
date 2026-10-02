# Urgent fix: the site is down for everyone because of the test-account rules

## What happened

The rules added today for Tester Shaun follow your logic: a real user is let straight through, and only the test user is checked. But 20 of those rules mention another table in their wording, for example "is this document's project test data?". The database inspects a rule's wording before it runs, and it found tables pointing back at each other in a loop. It refuses those requests outright, even though the answer for real users would have been "let through". That's why Proposals, Onboarding, Data Diagnostics and Companies are failing.

I only tested with elevated access, which skips these rules, so I missed it.

## The repair (small)

1. Add one sealed lookup that answers "is this record test data?". Because it's sealed, the database doesn't look inside it, so no loop is possible.
2. Change only the 20 broken rules to read: **real user -> let through; test user -> ask the sealed lookup.**
3. Change nothing else. No screens, no other rules, no data.

## Verification before I report back

- Signed in as a real admin, partner, super partner and client, open proposals, onboarding (documents, tasks, comments), data diagnostics, companies and team members, clients and profiles. Confirm there are no errors and the same records show as this morning.
- As Tester Shaun, confirm only test records show.

## Technical details

- One function `public.sandbox_is_test(_table text, _id uuid) returns boolean`: `security definer`, `stable`, `search_path = public`. It returns the `is_test` value of `proposals`, `project_onboarding`, `clients`, `companies` or `client_companies`, plus a `client_user` case for profiles. Execute is revoked from PUBLIC and granted to `authenticated` and `service_role`.
- Each of the 20 "Sandbox fence" policies is recreated as `NOT (select sandbox_current()) OR public.sandbox_is_test('<parent>', <fk>)`, keeping existing `user_id = auth.uid()` / profiles branches.
- Verification runs inside a read-only transaction with `set local role authenticated` and per-account `request.jwt.claims`, so the access rules really apply.
