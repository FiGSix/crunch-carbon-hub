# Why Quintin Barnard could not sign

## What actually happened

Quintin tried to sign his Wildeklawer "WK Pakhuis" agreement four times between 16:49 and 16:51 (SA time) today. Each attempt reached our system with his drawn signature attached — nothing was wrong with his link, his details or his signature.

During those exact minutes the database host was unreachable (a hosting-side outage: "Web server is down", error 521). Every attempt failed at the very first step, before anything was saved. Two other clients signing at the same moment (Monty Kerslake, Nigel McLeod) hit the identical failure.

The database is responding normally again as of 16:57.

Two separate problems come out of this:

1. **Nothing was saved for Quintin.** His agreement is still unsigned and his signing link is valid until 28 September, so he can simply try again now.
2. **The message he saw was wrong and alarming.** When the database is briefly unreachable, the signing page tells the client their invitation link is "invalid or expired". That sends people to support instead of telling them to try again in a minute — and it makes a healthy link look broken.

## Also worth knowing

Quintin has nine projects on his record. Only "WK Pakhuis" has a live signing link. Five others are still drafts that were never sent, and three older ones ("WK De Bron", "WK PS 3", "WK ROM PS1") have links that expired on 7 August. If he is meant to sign those too, they need to be re-sent.

## What I propose to do

1. **Immediate:** confirm the signing path is healthy again, and let Quintin retry his link. No data repair is needed — nothing partial was written.
2. **Fix the misleading message:** separate "we could not reach the system" from "this link is not valid". A temporary connection failure gets its own wording — "We could not reach our system just now. Please try again in a moment." — plus an automatic short retry before the client ever sees an error, so brief blips resolve invisibly.
3. **Same treatment on the page itself,** so a client who opens the agreement during an outage sees a retry prompt rather than a dead "link invalid" screen.
4. **Optional, on your say-so:** re-send the three expired links and review the five unsent drafts for Wildeklawer.

## Technical notes

- `supabase/functions/accept-proposal/index.ts` currently throws `Invalid or expired invitation token` whenever the `get_proposal_by_token_direct` lookup returns no row *or* errors. The 521 response came back as an error object whose `message` was an HTML page; that path must be distinguished and returned as HTTP 503 with a `retryable: true` flag, not 400.
- Add a bounded retry (2 attempts, short backoff) around the token lookup for network/5xx failures only — never for a genuine "no row" result.
- Client side: `src/pages/ProposalAcceptance/index.tsx` and its submit handler map any failure to the invalid-link state; they should branch on the new retryable flag and show a retry prompt with the signature still held in memory so nothing has to be redrawn.
- No database, RLS, PDF, email or onboarding changes. Existing signatures, agreements and audit records are untouched.
