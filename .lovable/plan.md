# Close the "anyone can make themselves a company admin" hole

## The problem

There is a rule on the client team-membership table that lets any signed-in
person add themselves as an **account admin** of **any** company, with no
invitation check. An account admin can see that company's projects, invite
people, remove members and grant signing rights — so this is a real
privilege-escalation risk.

## What I confirmed

- The permissive rule is `Users can create themselves as account admin`
  (insert rule, requires only `role = account_admin`, `status = active`,
  `user_id = auth.uid()` — no company check at all).
- Legitimate memberships are **not** created through this rule:
  - New client sign-ups get their company and admin membership from the
    automatic `auto_create_client_company` database trigger, which runs with
    elevated rights and bypasses these rules.
  - Team invitations are created by the `send-client-team-invitation` server
    function, which checks the inviter is an active account admin and also
    runs with elevated rights.
  - Admin linking/unlinking goes through dedicated admin-only database
    functions.
- The only app code that relied on self-insertion is `createClientCompany` in
  `src/lib/supabase/clientCompany/clientCompanyOperations.ts`, which is
  **not called anywhere** — dead code.
- The separate insert rule for account admins (invite path) stays untouched:
  it already requires `invited_by = auth.uid()`, `status = 'pending'` and
  membership of the same company.

## The fix

1. Migration: drop the `Users can create themselves as account admin` policy
   on `public.client_company_members`. No replacement policy is needed —
   every real path already runs server-side.
2. Remove the unused `createClientCompany` function so no future code
   accidentally depends on a path that can no longer work.

## Verification

- Re-list the table's policies and confirm the permissive one is gone and the
  invite/admin rules remain.
- Confirm sign-up still produces a company + admin membership (trigger path is
  unaffected by policies).
- Confirm the team management page still loads members, pending approvals and
  invitations, and that inviting a member still works.
- Mark the security finding as fixed and re-run the scanner.

## Note

Existing memberships are untouched; nobody loses access.
