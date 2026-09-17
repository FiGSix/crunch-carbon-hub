# Restore the eligibility questionnaire, and land users on "Crunch the Numbers"

## What we're fixing

1. The eligibility questionnaire pop-up was removed by mistake. Only the quick calculator pop-up should have gone. "Check Eligibility" should open the questionnaire again, not jump to the calculator.
2. When someone clicks "Calculate My Earnings" or "Get My Free Solar Credit Estimate" on the For Homes page, the calculator page should open scrolled so the "Crunch the Numbers" input section sits at the top of the screen.

## Changes

### Bring back the eligibility questionnaire
- Restore `src/pages/solar-rewards/EligibilityModal.tsx` from version history (6 qualifying questions, congrats step with confetti, and the details form that saves the lead).
- On the For Homes page, re-add the state that opens it.
- "Check Eligibility" buttons open the questionnaire:
  - hero second button
  - mobile sticky bar second button
  - the qualification section button
- When someone qualifies and finishes the questionnaire, they are sent on to the calculator as before.
- The quick calculator pop-up stays deleted.

### Land on "Crunch the Numbers"
- The estimate buttons keep going to `/calculator?segment=homeowner`, with `#crunch-the-numbers` added.
- Give the input panel that id and scroll it to the top of the viewport (allowing for the sticky header) on load when the hash is present.
- Buttons updated: hero "Get My Free Solar Credit Estimate", sticky bar "Calculate My Earnings", "Get My Detailed Calculation", and the final "Get Started".

## Technical notes
- Files: `src/pages/SolarRewards.tsx`, `src/pages/solar-rewards/HeroSection.tsx`, `src/pages/solar-rewards/QualificationSection.tsx`, `src/components/solar-rewards/StickyCtaBar.tsx`, `src/pages/Calculator.tsx`, `src/pages/calculator/SystemInputPanel.tsx`, restored `EligibilityModal.tsx`.
- Hero and sticky bar need two distinct handlers (`onCalculateClick`, `onCheckEligibility`) instead of the single `onCTAClick`.
- Calculator: on mount, if `location.hash === '#crunch-the-numbers'`, `scrollIntoView({ block: 'start' })` on the panel wrapper which carries `scroll-mt-24`.
- Verify with typecheck, build, and a browser pass at 1280 and 390 wide.

## Acceptance criteria
- "Check Eligibility" opens the questionnaire on desktop and mobile; no calculator redirect.
- Estimate buttons land on the calculator with "Crunch the Numbers" at the top, Homeowner pre-selected.
- No quick calculator pop-up anywhere.
