# Proposal signing page: cleaner numbers, mobile-friendly agreement, focused signing

## 1. Show the percentage only

In the "Your proposal in 30 seconds" card, "What you get" currently reads
"R72,456 (60.2% of carbon-credit revenue) — paid to you."

It becomes "60.2% of carbon-credit revenue — paid to you." The Rand figure is
dropped entirely. If no percentage is on record, the line falls back to
"your agreed share of carbon-credit revenue" as it does today.

## 2. Make the agreement easy to read on a phone

Today the agreement sits in a small fixed 400px-tall box inside the page, so on a
phone you are scrolling a tiny window inside another scrolling page — the common
"scroll trap" that makes it feel stuck.

Changes:

- On phones the agreement box grows to roughly three quarters of the screen
  height, so it reads like a page rather than a slot.
- A thin progress bar across the top of the agreement shows how far through the
  reader is, with "You have read 42%".
- A yellow (brand accent) round button pinned to the bottom-right of the
  agreement: tapping it scrolls one screenful further down. Its label changes to
  "Back to top" once the bottom is reached, and it disappears when the reader has
  finished.
- Larger text and line spacing on small screens, more comfortable padding, and
  headings within the agreement given a little extra space so clauses are
  visually separated.
- The green "Scrolled to bottom" confirmation stays and still unlocks signing.
  Signing stays gated on actually reaching the bottom — the yellow button steps
  down one screen per tap, it does not skip to the end.

## 3. Remove the WhatsApp share button while signing

The floating WhatsApp referral button currently appears on the signing page. It
is hidden on the proposal review/accept pages so nothing competes with signing.

## 4. Add a share moment after signing

On the "Your agreement has been signed successfully" screen, a new card appears
below the confirmation:

"You're now earning carbon credits from your solar system. Tell someone."

with a green WhatsApp button that opens WhatsApp with a ready-written message and
the client's own referral link, ready to send to a contact or post as a status.
Sharing is optional and never blocks onboarding.

## Technical notes

- `ThirtySecondSummary.tsx` — drop `totalClientRevenue` from `revenueLabel`; keep
  the `proposal.client_share_percentage ?? content.financialInfo.client_share_percentage`
  resolution.
- `TermsAndConditionsSection.tsx` — scroll container `max-h-[75vh] md:max-h-[400px]`,
  `onScroll` handler tracking `scrollTop/scrollHeight` for the progress bar, a
  `scrollBy({ top: clientHeight * 0.85, behavior: 'smooth' })` accent button,
  responsive type scale. The existing `IntersectionObserver` sentinel stays the
  single source of truth for `onScrolledToBottom`.
- `FloatingShareButton.tsx` — add a route match hiding it on `/proposals/:id/accept`
  and `/proposals/:id/decline`.
- `SignedSuccessScreen.tsx` — new share card reusing `buildReferralUrl`,
  `buildWhatsAppShareUrl` from `src/lib/referral.ts` with a new signed-client
  message variant.
- Verify with Playwright at 390x844 and 1280x1800 on the live proposal link.
