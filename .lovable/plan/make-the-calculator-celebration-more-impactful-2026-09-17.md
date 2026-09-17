# Make the calculator celebration more impactful

## Goal
Give the calculator result reveal the same celebratory impact as the eligibility success screen while preserving the calculator’s existing Crunch Carbon styling and information layout.

## Changes
- Keep the current result card, rolling figures, yellow value badge, expanding ring, solar icons, and staged fade-in.
- Add the eligibility screen’s wider confetti effect when a calculation completes, using a short burst from both sides of the screen so the celebration is clearly visible on desktop and mobile.
- Use the calculator’s existing brand palette—Crunch Yellow, ink/black, white, and a restrained green accent—rather than the eligibility modal’s orange and coral palette.
- Coordinate the full-screen confetti with the existing card-level particles so they feel like one reveal rather than two competing effects.
- Trigger the celebration once per completed calculation, including after a user edits their details and calculates again.
- Preserve reduced-motion support by showing the result immediately without animated particles when motion reduction is enabled.
- Keep the automatic positioning so “Your solar is already creating value” remains visible at the top of the result reveal.

## Verification
- Calculate an estimate on desktop and mobile and confirm the larger celebration is visible without obscuring the result or contact form.
- Confirm the headline stays in view, rolling numbers still animate, and recalculating triggers one fresh celebration.
- Confirm reduced-motion users receive a calm, non-animated result state.
- Check the project compiles cleanly after the change.

## Technical details
- Reuse the existing `canvas-confetti` dependency already used by the eligibility questionnaire rather than introducing another animation library.
- Keep the calculator’s existing Framer Motion particles for the local card treatment, but tune their timing around the wider confetti burst.
