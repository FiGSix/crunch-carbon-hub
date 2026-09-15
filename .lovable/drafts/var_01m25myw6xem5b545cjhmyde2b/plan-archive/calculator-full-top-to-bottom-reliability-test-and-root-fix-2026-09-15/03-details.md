## Implementation

1. **Fix duplicate matching at its source**
   - Keep calculator system size numeric, with a separate display value.
   - Extend the staged database update so both the incoming trigger values **and every existing proposal examined by duplicate matching** use the same safe numeric parser.
   - Preserve duplicate blocking and review rules; only malformed numeric text handling changes.
   - Cover size and GPS fields, since both currently use direct numeric conversions.

2. **Make proposal creation reliable**
   - Validate system size and commissioning date on the service, not only in the page.
   - Replace ignored client lookup/creation failures with explicit handling, including simultaneous submissions for the same email.
   - Verify the default Crunch Carbon owner before proposal creation.
   - Return stable error categories for invalid input, duplicate review, client creation, proposal creation, and email delivery.

3. **Show truthful outcomes**
   - Decode calculator-service responses so the page does not reduce every failure to the same message.
   - Require a valid proposal ID and secure link token before showing the unlocked success state.
   - Do not claim “check your inbox” when delivery failed; keep the proposal accessible on-screen and offer a clear retry/contact outcome.

4. **Add focused regression coverage**
   - Numeric and unit-suffixed sizes, malformed sizes, and GPS values.
   - First-time and existing-client submissions.
   - Repeated clicks, simultaneous requests, referral/default ownership, duplicate detection, and email failure.
   - Client-side limits and server-side validation must agree.

## End-to-end verification

Use **shaun@radiant.africa** for one controlled live submission after the corrected service is active:

1. Complete the page as homeowner and business, including panel helper, province, and commissioning-date validation.
2. Confirm the instant Rand estimate, generation, carbon credits, and tier agree with the saved proposal.
3. Submit Shaun's existing-client email once; confirm the existing client is reused and exactly one new proposal is created.
4. Confirm the forecast unlocks only after a valid proposal response.
5. Confirm the email arrives, its 10-day link opens the same proposal, and the review/sign page loads without registration blocking the token journey.
6. Verify the duplicate safeguard still blocks a genuine high-confidence duplicate without producing an unexplained server error.
7. Check desktop and mobile layouts, browser errors, network responses, service logs, build, and tests.

## Data safety

No legacy proposal rows need to be rewritten or deleted. The database function update is additive and applies when this draft is accepted. The final live test creates one real proposal and sends one real email to Shaun; it will be clearly identifiable as the controlled calculator test.
