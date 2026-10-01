# Close the 18 listed server-function security findings

Only the 18 findings you listed get fixed. Nothing else is touched or dismissed. All fixes keep the public flows working: the calculator, signing from an email link, declining, and unsubscribing.

## What changes for people using the platform

- Nobody signed out can send emails, create proposals, make documents, or look up agreements unless they hold a valid signing link for that exact proposal.
- Partners can only send invitations for their own proposals, and only to that proposal's client (plus the existing CC rules). Admins keep full access.
- Automatic jobs (reminders, weekly roundup, stale-proposal sweep, document sweep) keep running, because they use the existing system key.
- Address search on the calculator keeps working, with a usage limit.

## The fix for each finding (file confirmed during build, step 1)

| Finding | Function | Fix |
|---|---|---|
| Anyone can create eligibility proposals | send-eligibility-proposal | Never link to an existing client record from a public request; always create a new unlinked client, add a per-email/IP rate limit and input checks |
| Anyone can get signed links to legal documents | tmp-legal-doc-url | Delete the function (it was marked temporary) |
| Anyone can trigger installer emails | send-installer-invitation | Require admin, owning partner, or the system key |
| Invitations go to recipients the caller picks | send-proposal-invitation | Recipient always comes from the proposal's client record; caller must own the proposal or be admin |
| Send messages / spend money (2 paths) | likely send-contact-email, send-calculator-results | Fixed recipient for contact form; calculator results only to the email tied to that proposal; rate limits |
| Private data read without checks (2 paths) | likely ensure-proposal-agreement, post-signature-automation | Require valid signing link for that proposal, signed-in owner/admin, or system key |
| Anyone can generate signed contract documents | generate-cession-agreement-pdf / generate-signed-agreement-pdf | Allow only admin, owning partner, or system key (called by signing and the sweep) |
| Anyone can send roundup emails | send-weekly-roundup | System key or admin only; recipients taken from the database, never the request |
| Anyone can alter email reputation records | resend-webhook | Verify the email provider's webhook signature; reject unsigned calls |
| Anyone can trigger proposal automation | proposal-automation | System key or admin only |
| Anyone can retrieve agreement details | ensure-proposal-agreement | Valid signing link for that proposal, owner, or admin |
| Anyone can trigger client reminders | send-onboarding-followup / send-audit-ready-email | System key, admin, or owning partner only |
| Anyone can use address search | mapbox-geocode | Rate limit per IP, cap query length, allow only your own site origins |
| Admin approval email to any address | send-agent-approval-email | Look up the partner's email and name from their account by ID; ignore what the request sends |
| Oversized signature images | accept-proposal | Reject signatures over about 500 KB or not a PNG/JPEG image |
| Signed-in users invite arbitrary recipients | send-client-invitation | Caller must be admin or own the related client/proposal; block self-email as today |

## Order of work

1. Open each finding's details and confirm the exact function for the four "likely" rows.
2. Add one shared caller check (signed-in user, admin, owning partner, system key, or valid signing link) and use it everywhere above.
3. Apply each fix, update the app screens that call these functions if they send fields that are now ignored.
4. Deploy, then test signed-out calls are refused and the public calculator, signing link, decline and unsubscribe still work.
5. Mark the 18 findings fixed.

## One thing I may need from you

Checking the email provider's webhook signature needs its signing secret (from the Resend webhook settings). If it isn't already stored, I'll ask you to paste it in a secure box during the build.

## Technical details

- New `_shared/authorize.ts`: `resolveCaller(req)` returns `{kind: 'system'|'admin'|'user'|'anon', userId}` using `getClaims`, `has_role`, and comparison against `SWEEP_CRON_SECRET`; `canActOnProposal(callerOrToken, proposalId)` checks admin, `agent_id`, company teammate, or matching unexpired `invitation_token`.
- Rate limiting: small `edge_rate_limits` table (key, window_start, count) with GRANTs to service_role only, RLS on, no policies.
- Resend: verify `svix-id/svix-timestamp/svix-signature` with `RESEND_WEBHOOK_SECRET`.
- Delete `tmp-legal-doc-url` via the delete-function tool.
- Record the shared-authorization rule in AGENTS.md.
