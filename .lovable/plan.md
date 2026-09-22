# Why Justin's signatures vanished and Warren sees an error

## What the records actually show

**Justin Cackett tried to sign and the system refused him — twice.** Both attempts are recorded: 21 September 14:57 and this morning 04:50. Each time the answer was "Please sign in with an authorised company account to sign this agreement." Nothing was saved, so no signature, no agreement, no document. His four projects are untouched.

**This is not rare — it blocks nearly the whole recovery list.** 19 of the 22 remaining clients, covering 75 of the 79 outstanding projects, belong to a company that has at least one active member account. Every one of them will hit the same wall when they click the emailed link, because clicking a link from an email does not sign them in.

**Warren's "Error Loading Proposal / [object Object]".** The signing page shows the raw error object instead of the message. The real reasons it can fire are an expired or unrecognised link. Warren Confait has two links: one still valid to 20 November, one that expired on 24 May. Opening the expired one produces exactly this screen — no explanation, no way forward. The message is lost because the page only prints database errors that arrive as a standard error; anything else prints as "[object Object]".

## What to change

**1. The emailed link is enough to sign**

A recovery link is sent to one specific person at their own address and is unique to them. When someone opens their own link and the link is valid, they may sign — no login step. The login requirement stays for the case it was built for: a company project being signed by someone who is not the person the link was sent to, and anyone already signed in is still checked against the company's authorised signers.

**2. Say what went wrong, in words**

Replace "[object Object]" with the real reason and a next step:
- expired link: "This signing link has expired — ask Crunch Carbon to send a new one", with a request-new-link button
- unrecognised link: "This link is not valid"
- anything else: the actual message, never a blank object

**3. Get Justin signed, then rebuild everything of his**

Once the block is removed, Justin signs once and all four of his projects are re-signed against their own original dates with documents generated, per the rules already in place. Same for the other 18 blocked clients.

**4. Prove it before telling clients again**

Before any further emails go out, walk a real recovery link end to end in the browser as an outsider — open, read, sign, confirm the agreement row, the document and the recovery page all update. No batch re-send until that passes.

## Technical notes

- `accept-proposal` calls `authorizeCompanySigner({ companyId, authenticatedUserId, memberships })`; with `authenticatedUserId = null` and any active `client_company_members` row it returns `requiresAuthentication: true`. Add a token-holder branch: when the request carries a valid, unexpired `invitation_token` for that proposal and the proposal's client is the one the link was issued to, allow the signature and stamp `metadata.authorised_via = 'invitation_token'` for audit. Keep the existing signed-in path unchanged (`can_sign_agreements` still enforced).
- Refusals are already logged to `agreement_recovery_events` (`signing_refused_signer_not_authorized`) — keep that, and add an `allowed_via_token` event so admins can see what was let through.
- `src/pages/ProposalAcceptance/index.tsx` `fetchProposalByToken`: `supabase.rpc` returns a `PostgrestError` plain object, so `err instanceof Error` is false, `String(err)` renders `[object Object]`, and the `isExpiredError` admin/agent fallback never fires. Read `err.message` from PostgREST errors, map "Invalid or expired invitation token" to the expired copy, and keep the admin/agent RLS fallback working.
- Verified: `get_proposal_by_token_direct` itself returns correctly for a valid token (tested against Warren Confait's live link), so the loading fault is error presentation plus expired links, not the RPC.
- No change to who can see what, to existing signatures, documents, dates or calculations.
