# Clear the 279 older database warnings

## What they are (checked live)

| Type | Count | Meaning |
|---|---|---|
| Behind-the-scenes functions callable by signed-out visitors | 128 | Anyone on the internet can trigger them |
| Same, callable by any signed-in user | 137 | Any account (client, partner) can trigger them |
| Functions missing a fixed search path | 10 | Minor hardening |
| Two summary views running with owner rights | 2 | `proposal_engagement_buckets`, `portfolio_reminder_candidates` bypass row rules |
| Sign-in code expiry too long | 1 | Setting in Supabase dashboard |
| Leaked-password check off | 1 | Setting in Supabase dashboard |

The 265 function warnings cover about 137 functions: 35 are automatic triggers (never meant to be called directly) and 102 are callable functions. Only about 58 of those are actually used by the app or the edge functions. Some of the unused-but-open ones are risky, e.g. `create_agent_user`, `create_test_user_profile`, `backfill_super_partner_commissions`, `archive_proposal`/`delete_proposal` taking a user id as input.

## Approach — same "prove it before applying" method as the permission change

1. **Triggers (35):** remove direct-call access from everyone. Triggers still fire normally; nothing in the app calls them. Zero behaviour change.
2. **Unused functions (~44):** remove access from signed-out and signed-in users; edge functions (system access) keep working. Any genuinely dead ones are listed for you to approve deletion separately.
3. **Used functions (~58)** — sorted into three buckets, each checked against every place it is called:
   - **Public by design** (signing link, calculator, homepage stats, legal documents, invitation lookup, e.g. `get_proposal_by_token_direct`, `validate_token_direct`, `get_public_homeowner_stats`, `get_live_legal_document`, `mark_invitation_viewed`): keep open, verify each only returns what a token holder should see, then mark the warning as accepted with the reason.
   - **Signed-in only** (dashboards, role checks, client search): remove signed-out access; keep signed-in.
   - **Admin/system only** (partner API key checks, agreement recovery refresh, super-partner backfills, agent management): remove user access where only edge functions call them; where admin screens call them directly, confirm an admin check exists inside the function and add one if missing.
   - Functions that accept a user id as input (`delete_proposal`, `archive_proposal`, `get_agent_*`) are changed to use the signed-in user instead, so nobody can act as someone else.
4. **10 search-path warnings:** pin them. No behaviour change.
5. **2 views:** switch to run with the viewer's rights, after confirming the screens that use them (follow-up reminders, engagement) return identical results for admins.
6. **2 dashboard settings:** I can't change these from here — I'll give you the exact two clicks (shorten sign-in code expiry to 1 hour, turn on leaked-password protection).

## Safety

- Before each step, every function call in the app and edge functions is matched against the new access; any mismatch stops that step.
- Changes go in as a few small migrations, each with a one-step rollback.
- After applying: rerun the checker, and walk the key flows (calculator, signing link, onboarding, partner dashboard, admin agreement recovery, partner API).
- No data changes, no emails.

## Expected result

About 275 of 279 warnings cleared; the remaining handful are the intentionally public functions (accepted with written reasons) and the 2 dashboard settings for you to switch.

## Technical details

- `REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated` per function; `GRANT ... TO authenticated` / `anon` only where required; `service_role` retained.
- Note Postgres grants EXECUTE to PUBLIC by default: add `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC` so new functions start closed, and record this rule in AGENTS.md.
- `ALTER FUNCTION ... SET search_path = public` for the 10.
- `ALTER VIEW ... SET (security_invoker = true)` for the 2 views, verified by comparing admin results before/after.
- Call-site inventory from `rg "\.rpc\("` across `src/` and `supabase/functions/`, plus policy/function bodies that call other functions (e.g. `has_role`, `can_view_proposal` used inside RLS must stay executable by `authenticated`/`anon`).
