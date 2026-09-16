# Calculator in-place results transition

## Goal
Keep the user in the calculator's current position after they select **Calculate My Earnings**, replacing the input form with an animated results experience instead of adding results farther down the page.

## Changes
- Turn the calculator area into one stable in-place stage so its position and width remain consistent during the transition.
- When calculation starts, keep the existing “Crunching numbers…” feedback within the calculator area.
- On success, fade the input form out and fade the estimate into the same space; do not automatically scroll the page.
- Preserve the current estimate content: annual Rand income, yield/share explanation, generation, credits, coal avoided, trees, and estimate disclaimer.
- Retain the rolling number animations and coordinate their timing with the result reveal.
- Add a restrained Crunch Carbon celebration using yellow brand accents and lightweight motion rather than generic confetti; disable nonessential motion when reduced-motion is preferred.
- After the celebration/result reveal, fade in the **Let’s put your name on it** contact form beneath the result within the same calculator stage.
- Keep the existing proposal creation, email delivery, full forecast unlock, calculation rules, validation, and error handling unchanged.

## Interaction details
- Invalid inputs stay visible with their existing validation messages.
- A calculation failure keeps or restores the form so the user can correct or retry.
- The result stage will include a clear way to return and edit the solar-system details without reloading the page.
- Mobile and desktop layouts will avoid abrupt page jumps and reserve enough space during the transition to minimise layout shift.

## Verification
- Test valid, invalid, loading, failure, and recalculation paths.
- Confirm the input form disappears only after a successful calculation.
- Confirm results replace it in place, numbers roll, the celebration runs once, and the contact form appears after the reveal.
- Check phone and desktop sizes, keyboard focus, screen-reader announcements, and reduced-motion behavior.
