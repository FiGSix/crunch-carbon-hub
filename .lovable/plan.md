# Portfolio invitations: one email, one signature for many projects

## Goal
When a partner or admin has several draft proposals for the same client (e.g. Mixo at Flanagan & Gerard, 12 malls, 23.4 MWp), they can send **one** portfolio email. The client reviews all sites on **one** page and signs **one** Cession Agreement that covers every project.

## What gets built

1. **Send Portfolio Invitation button** (proposals list, partners and admins)
   - Tick several drafts for the same client, then a new "Send portfolio invitation" button appears next to "Move to onboarding".
   - A confirm window shows the recipient, number of sites, total kWp, estimated combined revenue, the site list and optional CC recipients.
   - Blocked with a clear message if the ticked proposals belong to different clients, or if any are already signed.
   - Partners can only select their own proposals.

2. **Portfolio email** (one email, same Crunch Carbon look as today)
   - Heading "Your solar portfolio: 12 sites, 23.4 MWp".
   - Combined estimated income, sites table (name, address, size, yearly income), eligibility note (claimable from 1 July 2026 unless tagged into Audit 1/2).
   - One button: "Review & sign portfolio". Decline link as today.

3. **Portfolio signing page**
   - Summary tiles: sites, total capacity, combined income, client share.
   - Sites table with a drop-down for each site's details.
   - The same Cession Agreement card (scroll to unlock, drawn signature), signed once.
   - After signing: all projects move to signed/onboarding, each gets its own signed agreement document, followed by the usual celebration and account step.

4. **Dummy preview for your review**
   - An admin-only "Portfolio email preview" in the existing Email Test panel. It builds the email from made-up sample data (12 invented mall sites) and sends it to **shaun@radiant.africa**, marked "TEST – sample data".
   - A demo portfolio signing page (`/portfolio/demo`) showing the same sample data. It is read-only and the signature button is disabled, so nothing is saved.

## Testing
- Send the dummy portfolio email to shaun@radiant.africa and confirm Resend delivery.
- Open the demo signing page on desktop and mobile widths and screenshot it.
- Unit tests: grouping rules (same client only, drafts only), combined totals, audit start dates via the existing shared audit-period rules.
- No live invitations go to Mixo or any real client. Nothing is created in live data apart from the test email log.

## Technical details
- New edge function `send-portfolio-invitation`: validates the JWT, checks the caller is an admin or the owner of every proposal, checks all proposals share `client_reference_id` and are unsigned, then gives all of them one shared portfolio token (new `portfolio_token` + `portfolio_id` columns on `proposals`, or a small `proposal_portfolios` table with RLS). It sends a single email through the shared brand-email and Resend helpers, applies the suppression list and CC rules, and logs to `proposal_automation_log`. It supports `{ dryRun: true, sample: true, to }` for the dummy send (admin only).
- New security-definer RPC `get_portfolio_by_token` (granted to anon, per project rule) returns sanitised site rows.
- Signing: `accept-proposal` accepts a portfolio token, validates the signer the same way as today, signs the first project, and relies on the existing `propagate_master_agreement` sweep to cover the siblings. It then makes sure each project in the portfolio gets its agreement PDF.
- Frontend: extend `BulkSelectionBar`, add `SendPortfolioInvitationDialog`, add route `/portfolio/:token` (reusing the ProposalAcceptance agreement/signature components) and `/portfolio/demo`.
- Revenue figures come only from `getEligibleStartDate` in `auditPeriods.ts` (client and `_shared` server mirror).
- Record the portfolio-token decision in AGENTS.md.
