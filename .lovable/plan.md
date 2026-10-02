# Fix "infinite recursion detected in policy for relation companies"

## What changed and why it broke

The error comes from today's test-sandbox work. To keep Tester Shaun walled off, I added a "sandbox fence" access rule to several tables. On the company team list, that rule checks the companies table to see whether a company is test data.

The companies table already had a rule, "Agents can view own company", that checks the company team list. Now each table checks the other:

```text
companies  --(Agents can view own company)-->  company_members
company_members  --(Sandbox fence)-->  companies   <- loop
```

The database spots the loop before it runs anything and refuses the request. That's why real users get this error, even though the fence is meant to do nothing for them. Anything that reads companies or company team members is affected, such as partner company lists and team pages.

The same pattern is on the agent invitation, team invitation and super partner link request rules. It's also on the client company rules, which check client companies. Those don't loop today, but they could break the same way.

## Fix

1. Add two small database checks, "is this company test data?" and "is this client company test data?". They run with elevated rights, so they don't trigger access rules and can't loop. They start closed and are granted only to signed-in users, per the project rule.
2. Rewrite the sandbox fence on company_members, team_invitations, agent_invitations, super_partner_link_requests, client_company_members and client_team_invitations to use those checks instead of reading the company tables directly.
3. Leave all other access rules unchanged.

## Verification

- For every partner, admin and super partner account, run a read-only check that the companies and company team list load without error, with the same visible rows as before the sandbox change.
- Confirm Tester Shaun still sees only test companies.
- Run the database linter for new warnings.

## Technical details

- New functions: `public.is_test_company(uuid)` and `public.is_test_client_company(uuid)`: `security definer`, `stable`, `search_path = public`. `REVOKE EXECUTE FROM PUBLIC`, then `GRANT EXECUTE TO authenticated, service_role`.
- Each fence becomes: `NOT (select sandbox_current()) OR public.is_test_company(<table>.company_id)` (keep the `user_id = auth.uid()` branch on company_members).
