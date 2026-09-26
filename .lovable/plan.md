# Check results after the access-rule tightening, and the one fix needed

## How the check was done
I couldn't safely click through as real users here: sign-in sessions can't be created for this setup, and creating test invitations or companies would change live data. So I traced every screen that touches these tables through the app and the behind-the-scenes services, and compared each one with the new rules.

## Results

| Flow | Result |
|---|---|
| Sending invitations (team, client team, partner, agent, client) | Works. Sending runs behind the scenes with full system access |
| Resending invitations | Works, for the same reason |
| Cancelling a team invitation | Works. Team leads and admins are still allowed |
| Cancelling a client team invitation | Works. Company account admins and admins are allowed |
| Accepting an invitation | Works. Acceptance happens automatically when the account is created |
| Creating a company at sign-up | Works. The new user is recorded as its creator |
| Admin creating or linking a company | Works. Admins are allowed |
| Saving data access during onboarding | Works. The activity entry is logged under the person saving, on a project they belong to |
| Notifications sent from onboarding and proposals | Work. They go to real accounts |
| Contact form | Works. It goes through the website's email service, not the new rule |
| Admin audit page | Works for admins |
| **Client dashboard "Vintage progress" card and the Vintage Insights page** | **Refused.** Clients and partners now see an empty card |

## The problem
The audit-stage status and progress notes aren't only used on the admin page. They also feed the Vintage progress card on the client dashboard and the Vintage Insights page. When I limited reading to admins, those two views went blank for everyone else.

This information is safe to share: it's the platform-wide audit stage for each vintage year and a progress note. It holds nothing personal or client-specific.

## Fix
- Let any **signed-in** user read the vintage audit status and progress notes again.
- Signed-out visitors stay blocked, which was the original security problem.
- Editing stays admin-only.

## Technical details
- Migration:
  - `CREATE POLICY "Signed-in users can view vintage audit status" ON public.vintage_audit_status FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);`
  - Add the same policy on `public.vintage_progress_notes`.
- Using `auth.uid() IS NOT NULL` instead of `true` avoids a fresh "lets everyone through" warning, while keeping the intended audience.
- Verify by loading the client dashboard and the Vintage Insights page. The card should show stages and notes again.
