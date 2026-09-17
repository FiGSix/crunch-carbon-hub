# Calculator: celebration straight to signing

## Goal
After the celebration, collect the few details needed for the cession agreement in one short form, then take the person straight to the signing page. The solar system details they already entered (size, province, commissioning date) carry through onto the proposal and into the signed agreement.

## What changes on screen

Replace the current "Let's put your name on it" email panel with a single **"Almost there — let's get your agreement ready"** card that appears after the celebration.

Fields (all required):

Residential
- First name
- Surname
- Contact number
- Email address
- Solar system address (address search with a "type it manually" fallback)

Business — the same, plus
- Business name

The card shows a small read-only strip of what they already told us (system size, province, commissioning date) with an "Edit solar system details" link, so they can see it is being carried over.

Button: **Continue to sign** (not "Unlock my forecast").

On success the page goes straight to the proposal signing page with their secure link. No results email is sent at this point — the signed agreement email follows after signing.

If something goes wrong, the form stays filled in with a clear message so they can retry.

## What gets saved

The details are stored on the proposal and on their client record so the cession agreement is filled in correctly:
- first name, surname, contact number, email, business name (business only)
- solar system address (plus map coordinates when chosen from the search)
- system size, province, commissioning date, segment — already captured, now written through consistently

## Technical notes

- `src/pages/calculator/EmailGatePanel.tsx` → rewritten as `ContactDetailsPanel.tsx`: zod-validated form (names, SA-format contact number, email, address min length, business name when `segment === "business"`), uses `MapboxAddressAutocomplete` with a manual-entry toggle, same pattern as `ProjectDetailsStep.tsx`.
- `src/hooks/calculator/useCalculatorResults.ts`: params extended with `firstName`, `lastName`, `phone`, `companyName`, `addressLat`, `addressLng`, `sendEmail`.
- `supabase/functions/send-calculator-results/index.ts`:
  - accept and validate the new fields (server-side, not just client-side); keep `name` accepted for backwards compatibility but prefer explicit first/last.
  - pass `p_phone` and `p_company_name` into `find_or_create_client_by_email` instead of the current `null, null`.
  - write `clientInfo` (first_name, last_name, phone, company_name, email) and `projectInfo` (address, lat/lng, province, commissioning date, size, segment) into proposal `content` and `project_info`; run project info through the same size/`size_display` convention already used elsewhere.
  - add a `sendEmail` flag (default true) so the calculator path skips the results email; every other caller is unaffected.
  - reuse-existing-estimate and duplicate-guard behaviour unchanged; when an existing estimate is reused, patch it with the newly supplied contact and address details.
- `src/pages/Calculator.tsx`: on success, `navigate(`/proposals/${id}/accept?token=${token}`)` instead of revealing `FullForecastPanel` / `ProposalPreviewPanel` inline. Those two panels stay in the codebase only if still referenced elsewhere; otherwise they are removed from the calculator flow.

## Verification
- Homeowner and business paths, valid and invalid input, address search and manual entry.
- Confirm the created proposal carries name, surname, phone, email, address, business name, size, province and commissioning date.
- Confirm signing the agreement produces a PDF with those party details filled in.
- Desktop and 390px mobile; keyboard and reduced-motion behaviour unchanged.
