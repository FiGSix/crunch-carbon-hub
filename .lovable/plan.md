# Why Quintin Barnard could not sign

## What actually happened

Quintin tried to sign his Wildeklawer "WK Pakhuis" agreement four times between 16:49 and 16:51 (SA time) today. Each attempt reached our system with his drawn signature attached — nothing was wrong with his link, his details or his signature.

During those exact minutes the database host was unreachable (a hosting-side outage: "Web server is down", error 521). Every attempt failed at the very first step, before anything was saved. Two other clients signing at the same moment (Monty Kerslake, Nigel McLeod) hit the identical failure.

The database is responding normally again as of 16:57.

Two separate problems come out of this:

1. **Nothing was saved for Quintin.** His agreement is still unsigned and his signing link is valid until 28 September, so he can simply try again now.
2. **The message he saw was wrong and alarming.** When the database is briefly unreachable, the signing page tells the client their invitation link is "invalid or expired". That sends people to support instead of telling them to try again in a minute — and it makes a healthy link look broken.

## One signature must cover all his projects

Quintin has nine projects on his record: "WK Pakhuis" (the live link), three older ones whose links expired on 7 August, and five that were never sent.

The platform already does this: when a client signs once, every other project under that client — including unsent drafts and expired ones — is automatically marked signed, gets its own cession agreement built from the same signature, and each document is generated and emailed. So once Quintin signs "WK Pakhuis", all nine become signed with their own cessions. No re-sending of the expired links is needed for signing purposes.

The one weak point: the step that builds and emails those extra documents runs only once, immediately after signing. If it is interrupted — exactly the kind of outage that just happened — the projects still show as signed but their documents never appear, with nothing to catch it. This plan adds a safety net.

## What I propose to do

1. **Immediate:** confirm the signing path is healthy again and let Quintin retry his link. No data repair is needed — nothing partial was written.
2. **Fix the misleading message:** separate "we could not reach the system" from "this link is not valid". A temporary connection failure gets its own wording — "We could not reach our system just now. Please try again in a moment." — plus an automatic short retry before the client sees any error, so brief blips resolve invisibly.
3. **Same treatment on the page itself,** so a client who opens the agreement during an outage sees a retry prompt rather than a dead "link invalid" screen.
4. **Safety net for the inherited documents:** a scheduled hourly check that finds any signed project whose cession document was never produced, builds it and emails it. This makes the "one signature covers everything" promise hold even when something fails mid-way.
5. **After Quintin signs:** verify all nine of his projects show as signed and each has its own document, and report back.

## Technical notes

- `supabase/functions/accept-proposal/index.ts` currently throws `Invalid or expired invitation token` whenever the `get_proposal_by_token_direct` lookup returns no row *or* errors. The 521 response arrived as an error object whose `message` was an HTML page; that path must be distinguished and returned as HTTP 503 with a `retryable: true` flag, not 400.
- Add a bounded retry (2 attempts, short backoff) around the token lookup for network/5xx failures only — never for a genuine "no row" result.
- Client side: `src/pages/ProposalAcceptance/index.tsx` and its submit handler map any failure to the invalid-link state; branch on the new retryable flag and show a retry prompt with the signature still held in memory so nothing has to be redrawn.
- Propagation itself needs no change: the `propagate_master_agreement()` trigger already copies the signature to sibling proposals in `draft/sent/delivered/opened/viewed/stale` and flips them to `approved`. Verified it matches on client id, shared email and client company.
- `sweep-agreement-documents` is currently only invoked inline by `accept-proposal`. Add a `pg_cron` job (hourly) posting to it with the service role, alongside the existing `weekly-roundup-emails` job; the function is already idempotent (`pdf_path is null` filter, capped batch).
- No RLS, schema, legal-document or calculation changes. Existing signatures, agreements and audit records untouched.
