# Delete/archive safety fix + live testing of last round's changes

## Answer to your question
No, they aren't admin-only today. Both functions let three kinds of people act on a proposal: its partner (agent), its client, or an admin. The app's Delete button only appears for partners and admins, but that check only happens on the screen.

The real problem: the function believes whatever user ID it's handed. So a signed-in user could pass an admin's ID and delete or archive **any** proposal. That's worth fixing now.

## 1. Fix delete and archive at the root
- Both functions use the signed-in person, not an ID passed in.
- Who can act (please confirm): **admins on any proposal, partners only on their own**. Clients can't delete or archive. This matches what the app already shows.
- Delete also clears the client's cession link, so it will refuse proposals that are signed or in onboarding unless an admin does it. Otherwise one click could erase a signed agreement's anchor.
- Update the app's single delete call to match. Archive isn't called anywhere in the app. It stays available for admins, and nothing else uses it.

## 2. Test the two summary views (engagement buckets and reminder candidates)
- For every partner and admin account, compare what each view returns now with what the old unrestricted version would return, filtered to that person's projects. They should match row for row.
- Report any account where they differ, and fix it before closing.

## 3. Click through as real users
- **Client (Client Shaun, shaun@radiant.africa):** run the calculator from start to finish, then open the emailed signing link and sign. Confirm the agreement and document are saved, then log in and check the client dashboard (including the Vintage card).
- **Partner and admin dashboards:** load the proposals, clients, onboarding, Agreement Recovery and Vintage Insights pages. Watch for any "permission denied" error.
- Sign-in sessions can't be created automatically for this setup. If a step needs Shaun logged in, I'll use his emailed login link if that works, or ask you for a one-time login.
- The test proposal is removed afterwards so it doesn't show in reports.

## Technical details
- New `delete_proposal(proposal_id)` and `archive_proposal(proposal_id)` use `auth.uid()` plus `has_role`. The old two-argument versions are dropped, and EXECUTE is granted to `authenticated` only.
- The guard on signed/onboarding proposals checks `signed_at` and whether a `project_onboarding` row exists.
- Update `useDeleteProposal.ts` to use the new call. The comparison in step 2 is a read-only SQL diff done as `postgres`, with each viewer's scope rebuilt by hand.
