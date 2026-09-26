# Close 21 "access rule lets everyone through" findings

## What's wrong
On 21 tables, one of the access rules says "yes" to everyone it covers. Some of them let any visitor, including people who aren't signed in, add or change records. For example, anyone could accept or cancel other people's invitations, create companies, write fake notifications or audit entries, or edit audit progress notes. The other rules on these tables are fine. Only these catch-all rules need replacing.

## Approach
Replace each catch-all rule with the narrowest rule that still lets the current app work. Anything the app only does behind the scenes (emails, webhooks, sign-up, database triggers) already runs with full system access and doesn't need these rules, so those rules are removed. Nothing visible changes for admins, partners or clients.

| Table | Current catch-all | Replacement |
|---|---|---|
| notifications | anyone can insert | signed-in users only, and the sender must be a real user. System alerts keep working |
| team_invitations, client_team_invitations | anyone can update | only the company's admins (to cancel or resend) or platform admins |
| agent_invitations, partner_invitations, client_invitations | anyone can update | platform admins, or the person who sent the invitation. Accepting an invitation already runs behind the scenes |
| partner_invitations, client_referrals | anyone can insert | platform admins or the sender only. Referrals are recorded behind the scenes |
| client_referrals | anyone can update | removed (behind the scenes only) |
| companies, client_companies | anyone can insert | platform admins, or a signed-in user creating their own company (creator = themselves) |
| project_onboarding | anyone can insert | platform admins only. Onboarding rows are created by the signing process behind the scenes |
| onboarding_activity_log, proposal_automation_log | anyone can insert | signed-in users writing entries in their own name, on projects they can see |
| user_role_audit | any user can insert | removed. Role changes are logged by the database itself |
| partner_api_logs, partner_webhook_deliveries | anyone can insert or update | removed (partner system only) |
| contact_submissions | anyone can insert | stays public, because the website contact form needs it. Adds basic checks: required fields and length limits |
| vintage_audit_status, vintage_progress_notes | anyone, even signed-out visitors, can read | admins only. These are admin audit screens |
| carbon_rate_sets, regional_solar_yields, inverter_portal_defaults | any signed-in user can read | stays readable, because the calculator and onboarding need it. It holds only public reference figures and has no personal data. Editing stays admin-only |

The last three were already safe. They'll be closed with a clear written reason instead of being narrowed.

## Checks before closing
- For each role (admin, partner, client, super partner) and for signed-out visitors, confirm the flows that write to these tables still work: invitations (send, cancel, accept), company creation and linking, onboarding data-access save, notifications, the contact form, the calculator, and the admin audit pages.
- Run the security scan again and confirm all 21 findings are cleared, then mark them fixed. No other findings are touched.

## Technical details
- One migration: `DROP POLICY` for each tautological policy, then `CREATE POLICY` with scoped expressions using the existing helpers (`is_current_user_admin()`, `has_role`, `is_client_account_admin`, `is_company_member`, `can_view_proposal`, `auth.uid()`).
- Inserts from the browser keep working:
  - `notificationService`, `DataAccessTab`, `clientProjectSubmission`, `ReliableProposalService` write to notifications. The check is `auth.uid() is not null`.
  - `companyOperations` / `clientCompanyOperations` / `ManageCompanyLinkDialog` write to companies. The check is `created_by = auth.uid()` or admin. The column is verified before the migration; if it's missing, the check falls back to admin or `ensure_agent_has_company` behind the scenes.
  - `agentContactLogger` writes to proposal_automation_log. The check is `created_by = auth.uid()`.
- Service-role policies are left as they are, because the scanner didn't flag them.
- Use `manage_security_finding` `mark_as_fixed` for the 18 narrowed findings. For the 3 reference-data tables, use `ignore` with an explanation, or `mark_as_fixed` if the rescan clears them.
