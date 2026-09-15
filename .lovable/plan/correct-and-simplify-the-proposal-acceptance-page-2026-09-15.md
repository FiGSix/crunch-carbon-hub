# Correct and simplify the proposal acceptance page

## Confirmed cause

Proposal `47de89f2-a766-4cc2-aa31-782791a0515e` has no value in its main client-share field, but its saved calculator data records the client share as **60.2%**. The “Your proposal in 30 seconds” card currently substitutes a hardcoded **80%** whenever the main field is blank, causing the contradiction.

## Changes

1. **Use the proposal’s real saved share**
   - Resolve the displayed client share from the main proposal field first, then the saved calculator value.
   - Remove the hardcoded 80% fallback so this proposal shows **60.2% of carbon-credit revenue**.
   - Keep the Rand total as the preferred wording when a valid saved client-revenue total exists.

2. **Simplify the top of the signing page**
   - Remove the “You are accepting the following proposal” card.
   - Make “Your proposal in 30 seconds” the first card.
   - Enlarge the greeting and use the full resolved client name instead of taking only the first word. For this record, that means `Hi Client Shaun,` rather than `Hi Client,`.
   - Remove both buttons and the closing “We’re not chasing you…” sentence from this card.

3. **Focus the page on the agreement**
   - Rename “Full proposal & Cession Agreement” to “Cession Agreement”.
   - Replace its supporting text with: “Please scroll through the agreement until you get to the bottom to unlock signing. Please review the proposal details and terms.”
   - Remove the proposal-summary card beneath this heading from the new-signature journey.
   - Leave the existing-agreement confirmation journey unchanged, where its project summary is still useful.

4. **Clarify the signing instruction**
   - Change “Step 1: Read Terms & Conditions” to “Step 1: Scroll through and Read Terms & Conditions.”

5. **Clean up and verify**
   - Remove imports, props, and dead code made obsolete by these page changes.
   - Check this exact emailed link on desktop and mobile, confirming 60.2%, the client’s full name, the revised order/text, removed cards/buttons, and scroll-to-unlock signing behavior.
   - Run the relevant automated checks and confirm the page builds without errors.

## Technical note

This is a presentation/data-resolution correction. It will not overwrite the proposal or alter its commercial terms; the acceptance page will read the already-saved 60.2% calculation instead of inventing 80%.
