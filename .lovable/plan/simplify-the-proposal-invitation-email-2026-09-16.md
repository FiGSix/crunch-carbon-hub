# Simplify the proposal invitation email

## What will change

### Header and opening
- Replace the typed **Crunch Carbon** header text with the existing hosted Crunch Carbon logo, retaining **Solar Carbon Credits** on the right.
- Remove **Your solar carbon income proposal is ready** from the visible email.
- Keep the personalised greeting, for example **Dear Hope Segone,**.
- Move the sender explanation immediately below the greeting and replace it with the supplied copy explaining that the proposal covers potential carbon-credit earnings from the installed solar system.
- Build the sender’s full name, company and email from the partner who sent the invitation; retain the safe generic fallback when partner details are unavailable.
- State that the sender is copied into the email only when their email is present and actually added to CC.

### Remove the commercial summary
- Remove the complete **Your proposal in 30 seconds** section from this invitation email, including project name, estimated Rand income and the client/site/system/revenue table.
- Leave the proposal calculations and proposal pages unchanged; this is an email-only presentation change.

### Replace the next-steps card
- Replace the current Review / Sign / Onboard card with **What’s next?** and the three supplied explanations:
  1. **Review Proposal**
  2. **Accept & Sign**
  3. **Decline**
- Use the requested meaning while correcting obvious grammar and punctuation so the client-facing email reads professionally.

### Three actions
- Place three equal-size actions directly below the explanation:
  - **Review Proposal** → existing full proposal link
  - **Accept & Sign** → existing direct signing link
  - **Decline** → existing decline link
- Keep them in one row on wider email clients and stack them full-width on narrow phone screens for readable labels and reliable tapping.
- Use email-safe table markup and inline styling, with the primary Crunch Carbon yellow treatment retained for the main action.

### Disclaimer and closing
- Update the disclaimer to the supplied wording, including **verified generation from your system** and the existing 10-day/no-account explanation.
- Keep the existing **Warm regards**, Crunch Carbon sign-off and footer unchanged.
- Update the plain-text alternative to match the revised content, order, labels and three URLs.

## Technical notes
- Work remains inside `send-proposal-invitation`; no proposal data, calculations, database records, invitation tokens or destination URLs change.
- Reuse the existing hosted Crunch Carbon logo URL already used by branded Crunch Carbon emails, with meaningful alt text and fixed dimensions for email-client stability.
- Remove now-unused summary rendering helpers and imports from this email template rather than leaving dead code.

## Verification
- Render a representative invitation at desktop and phone widths and confirm the logo, greeting, sender copy, next steps, links, disclaimer, sign-off and footer display correctly.
- Confirm the old heading and full commercial summary are absent.
- Confirm each action points to its correct existing destination and stacks on phones.
- Confirm the plain-text email carries the same revised message and all three links.
