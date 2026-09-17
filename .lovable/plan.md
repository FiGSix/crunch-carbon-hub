# Never lose a signature: sign-in before signing

## What happened to Client Shaun

- His signing attempt at 07:09 today was **refused by the server** — there is no signature and no agreement on that project, and it is still sitting at "sent".
- Reason: his email already has an account, and accounts are automatically attached to a company profile. Our authorised-signer rule (added for Rhino Energy) says that when a client's company has active members, only a signed-in authorised member may sign. He was signing anonymously from the calculator link, so he was blocked.
- The refusal happens **after** he reads the agreement and draws his signature, and it automatically sends him to the login screen. After logging in he returns to the same page with nothing saved — so he is asked to sign again.

## Login logic today (for reference)

- **Brand-new person, no account:** no company member exists, so they sign anonymously straight from the calculator. No login at any point. Login is only offered afterwards, as a one-click email link to start onboarding.
- **Person who already has an account:** blocked at the moment of signing, sent to login, and their work is lost.
- A brand-new person whose work email domain matches a company where a colleague already has an account also gets blocked the same way.

## The fix

Keep the authorised-signer rule exactly as it is — it protects companies like Rhino. Move the check to the front, so nobody ever draws a signature that is going to be thrown away.

1. **Check before the ceremony.** When the signing page loads, ask the server whether this project requires a signed-in signer. If it does and the visitor is not signed in, show a clear panel instead of the agreement: "This project belongs to <company>. Please sign in to review and sign." with a Sign in button that returns straight back to the agreement.
2. **Return exactly where they left off.** The sign-in link carries the project and its token, so after logging in they land back on the agreement, signed in, and sign once.
3. **Not authorised at all?** If they sign in but their account is not allowed to sign for that company, say so plainly and name who can, instead of a generic error at the end.
4. **Calculator flow.** After the person enters their details and before the agreement opens, check whether that email already has an account. If it does, send them through sign-in first and then straight to the agreement — so the calculator journey never dead-ends.
5. **Already signed.** If the project has already been signed, the page shows the signed confirmation rather than the signing form.
6. **Shaun's test project.** Leave the data alone; he can simply sign it again once the fix is in — it will then work in one pass.

## Technical notes

- New lightweight read-only mode on the existing `accept-proposal` / a small companion check that reuses `authorizeCompanySigner` in `supabase/functions/accept-proposal/signer-authorization.ts`, returning `{ requiresAuthentication, allowed, companyName }` without recording anything.
- `src/pages/ProposalAcceptance/index.tsx`: call it alongside `resolveAgreementState`, and render a sign-in gate (new small component) when `requiresAuthentication` is true and no session exists. Keep the existing post-submit `requiresAuthentication` redirect as a safety net.
- Gate links to `/login?returnTo=<pathname+search>`; `src/pages/Login.tsx` already honours `returnTo`.
- Calculator: `src/pages/calculator/ContactDetailsPanel.tsx` / `Calculator.tsx` — after `send-calculator-results` returns the proposal id and token, the same check decides whether to navigate to the agreement or to `/login?returnTo=…`.
- Signed state: use the `existing` state already returned by `ensure-proposal-agreement` plus `proposal.signed_at` to render the signed confirmation.
- Verify on desktop and 390px mobile: new client signs with no login; existing-account client is asked to sign in up front and signs once; unauthorised member sees a clear message.
