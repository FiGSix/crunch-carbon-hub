# Urgent fix: site-wide "infinite recursion" errors since the test-sandbox change

## What changed and why it broke

Today's test-sandbox work for Tester Shaun added a "sandbox fence" access rule to about 40 tables. On 20 of them, the fence looks up a parent table to ask "is this test data?". For example:

- A project's agreements, emails, commissions and linked clients look up **proposals**.
- Onboarding documents, tasks, fields, comments, the activity log and data diagnostics look up **onboarding projects**.
- Company team members and invitations look up **companies**, and client team members look up **client companies**.
- Cession signatures look up **clients**, and people's profiles look up **clients**.

Many of those parent tables already have rules that look the other way. Proposals check their linked clients, and companies check their team members. Now each pair of tables checks the other, in a loop:

```text
proposals        -> proposal_clients   -> proposals          (loop)
companies        -> company_members    -> companies          (loop)
project_onboarding -> onboarding_*     -> project_onboarding (loop)
clients          -> profiles           -> clients            (loop)
```

The database spots these loops before it reads anything and refuses the whole request. That's why Proposals, Data Diagnostics, Onboarding and Companies all fail for real users, even though the fence is meant to do nothing for them. My earlier verification only ran the sandbox switch and reset with elevated access, which skips access rules. That's why it didn't catch this.

## Fix (one change, covers every affected table)

1. Add five small "is this test data?" checks for a proposal, onboarding project, client, company and client company. They run with elevated rights, so they never trigger other access rules and can't loop. They start closed and are granted only to signed-in users, per the project rule.
2. Rewrite all 20 fences that look up a parent table so they use those checks instead. Real users keep the same "do nothing" behaviour, and Tester Shaun keeps seeing only test data.
3. Leave every other access rule unchanged.

## Verification before reporting back

- Signed in as a real admin, partner, super partner and client, load proposals, onboarding projects and their documents and tasks, data diagnostics, companies and team members, clients, cession signatures and profiles. Confirm there are no errors and the row counts match what each account saw before today's change.
- Repeat the check as Tester Shaun and confirm only test rows appear.
- Run the database linter for new warnings.

## Technical details

- New functions, all `security definer`, `stable`, `set search_path = public`, `REVOKE EXECUTE FROM PUBLIC`, `GRANT EXECUTE TO authenticated, service_role`: `is_test_proposal(uuid)`, `is_test_project(uuid)`, `is_test_client(uuid)`, `is_test_company(uuid)`, `is_test_client_company(uuid)`, plus `is_test_client_user(uuid)` for the profiles fence.
- Each fence is dropped and recreated as `NOT (select sandbox_current()) OR public.is_test_<parent>(<table>.<fk>)` for both `USING` and `WITH CHECK`. Existing extra branches such as `user_id = auth.uid()` on company_members and the profiles branches are kept.
- Tables: agent_commissions, email_events, proposal_agreements, proposal_automation_log, proposal_clients, super_partner_commissions, data_access_config, onboarding_activity_log, onboarding_comments, onboarding_documents, onboarding_fields, onboarding_tasks, client_cession_signatures, agent_invitations, company_members, super_partner_link_requests, team_invitations, client_company_members, client_team_invitations, profiles.
- Verification uses `set local role authenticated` with `request.jwt.claims` set per account inside a read-only transaction, so access rules really apply.
