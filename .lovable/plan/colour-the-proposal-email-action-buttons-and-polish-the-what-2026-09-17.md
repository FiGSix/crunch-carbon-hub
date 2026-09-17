# Colour the proposal-email action buttons and polish the "What's next?" card

## What we will do

1. Update the three action buttons in the proposal invitation email template (`supabase/functions/send-proposal-invitation/email-service.ts`):
   - **Review Proposal** — green button (`#22C55E`) with white text.
   - **Accept & Sign** — Crunch Carbon yellow (`#FFC400`) with black text (unchanged background, but text will be ink for contrast).
   - **Decline** — soft red / danger tone (`#DC2626`) with white text.
   Keep full-width stacking on mobile and equal sizing on desktop.

2. Rewrite and re-layout the "What's next?" card so it reads more professionally but still feels inviting:
   - Lead with a short, encouraging sentence.
   - Present the three options as clear, bold headings with concise explanations, not a numbered list.
   - Keep the same three actions (Review, Accept & Sign, Decline) with unchanged links.
   - Update the plain-text template to mirror the new wording.

3. Verify the rendered HTML locally using the existing stubbed Resend / inline template harness, and check mobile stack behaviour.

## Proposed "What's next?" copy

> **What happens next?**
> You are in control. Choose one of the options below and we'll take care of the rest.
>
> **Review your proposal first**
> Open your proposal on the Crunch Carbon platform, read through the details, and decide when you're ready.
>
> **Accept & sign online**
> Ready to move forward? Accept the proposal and sign the Cession Agreement securely in just a few clicks.
>
> **Decline this proposal**
> If this isn't right for you, select Decline and we'll close this proposal with no follow-up pressure.

## Files to change

- `supabase/functions/send-proposal-invitation/email-service.ts` (HTML and plain-text templates)

## Out of scope

- No changes to button links, token behaviour, subject line, or sender details.
- No changes to the proposal acceptance/decline web pages.
