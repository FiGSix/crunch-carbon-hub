# Rhino Energy portfolio and authorised signing

## Goal
Keep Juan as the contact on Rhino Energy’s existing projects, give all active Rhino company members the same portfolio visibility, and ensure each signed agreement names only the person who actually signed it.

## Confirmed current state
- Rhino Energy has 10 active proposals: 9 retain Juan as the contact and 1 retains Naazia as the contact.
- Juan and Naazia are active account administrators of the same Rhino company record.
- Juan’s signing permission is disabled; Naazia’s is enabled.
- The database’s company-access rules currently make all 10 proposals eligible for both users, so Naazia’s one-project screen must be reproduced in her real signed-in journey before changing visibility logic.
- Signing permission is currently checked in the page, but not enforced by the server action that records a signature.
- The signing action and PDF fallback can use the proposal contact’s identity, which is why Juan’s name can appear even when another person is intended to sign.

## Implementation
1. **Reproduce Naazia’s portfolio view**
   - Run the real proposals and onboarding journeys as Naazia and capture the query/page that returns only one project.
   - Compare it with the database-authorised set of 10 and fix the responsible stale cache, extra contact-only filter, or alternate data path.
   - Consolidate the affected client portfolio path onto the existing company-aware access rule rather than adding another special case.

2. **Separate contact from signer**
   - Preserve Juan as the contact on the nine existing proposals and keep their normal contact/email history unchanged.
   - Stop using the proposal contact as the default signatory for company agreements.
   - For a signed-in signer, derive the signer from the validated account and its profile; do not trust a caller-supplied user ID or the proposal’s linked contact.

3. **Enforce signing permission on the server**
   - Validate the bearer session in the proposal-acceptance action.
   - For a company proposal, require an active membership in that proposal’s company with `can_sign_agreements = true` before accepting an authenticated signature.
   - Explicitly reject Juan while his signing permission is disabled, even if he calls the action directly.
   - For a company that already has active portal members, require sign-in before token-based signing so a transferable email link cannot bypass the company’s signer permissions. Preserve direct token signing for unmanaged external recipients.

4. **Render the actual signer on completed documents**
   - Store the validated signer’s account/profile identity separately from the proposal contact/client identity.
   - Populate signature confirmation and generated signed PDFs from that stored signer identity only.
   - Keep Rhino Energy as the contracting party and Juan as the project contact; neither should overwrite the natural person who signs.
   - Remove the fallback that prints the linked contact’s name as the signatory on newly signed company documents.

5. **Verification and regression coverage**
   - Confirm Naazia sees all 10 active Rhino projects in both Proposals and Project Onboarding.
   - Confirm Naazia can sign a Juan-contact proposal and the stored agreement/PDF names Naazia as signer while retaining Juan as contact.
   - Confirm Juan can view the same portfolio but cannot sign through the page or a direct authenticated request.
   - Confirm a caller-supplied alternate signer name or user ID cannot take effect.
   - Verify anonymous token signing separately for managed companies and unmanaged recipients.
   - Check desktop and mobile acceptance screens, then run targeted tests and confirm the preview build is clean.

## Data handling
No Rhino proposals will be reassigned and no historical signed agreement will be rewritten automatically. Any previously completed document requiring correction will be reported separately before replacement.
