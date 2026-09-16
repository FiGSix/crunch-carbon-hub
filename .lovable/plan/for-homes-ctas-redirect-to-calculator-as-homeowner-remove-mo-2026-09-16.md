# For Homes CTAs: redirect to calculator as Homeowner, remove modals, boost Check Eligibility

## What we're changing
On the `/home-owners` (Solar Rewards) page:
- Both "Get My Free Solar Credit Estimate" and "Get My Detailed Calculation" will navigate to `/calculator?segment=homeowner` instead of opening the inline Quick Calculator modal.
- The calculator will read that query parameter and lock the segment toggle to **Homeowner**.
- "Check Eligibility" becomes a primary, high-visibility action: a second button in the hero section and an additional button in the mobile sticky bottom bar.
- The QuickCalculatorModal and EligibilityModal are removed from the page and deleted from the codebase (no other references).
- The Final CTA's "Get Started" also navigates to the calculator.

## Why
The current page has three entry points that all open separate modals, splitting the journey. Routing homeowners straight to the calculator keeps them on one path and lets the calculator validate system details before they commit. Making "Check Eligibility" more visible encourages users to confirm they qualify before calculating.

## Files to change
1. `src/pages/Calculator.tsx`
   - Read `segment` from `useSearchParams`.
   - If `segment=homeowner` or `segment=business`, set the initial `segment` state; otherwise keep the current default (`homeowner`).
2. `src/pages/SolarRewards.tsx`
   - Replace `setShowCalculator(true)` and `setShowEligibility(true)` handlers with a single `navigate('/calculator?segment=homeowner')` handler.
   - Remove `useState` for modals, remove `QuickCalculatorModal` and `EligibilityModal` imports/JSX.
   - Pass navigation handler to `HeroSection`, `EarningsEstimator`, `QualificationSection`, `FinalCTA`, `StickyCtaBar`.
3. `src/pages/solar-rewards/HeroSection.tsx`
   - Add a second prominent button: "Check Eligibility" next to "Get My Free Solar Credit Estimate".
   - Both call the parent handler.
4. `src/pages/solar-rewards/EarningsEstimator.tsx`
   - Change "Get My Detailed Calculation" to navigate to `/calculator?segment=homeowner`.
5. `src/pages/solar-rewards/QualificationSection.tsx`
   - Change button text from "See If I Qualify" to "Check Eligibility" and route to calculator.
6. `src/pages/solar-rewards/FinalCTA.tsx`
   - Change "Get Started" to navigate to calculator.
7. `src/components/solar-rewards/StickyCtaBar.tsx`
   - Add a second button or convert to "Check Eligibility" primary action; keep mobile-optimized layout.
8. Delete unused files:
   - `src/pages/solar-rewards/QuickCalculatorModal.tsx`
   - `src/pages/solar-rewards/EligibilityModal.tsx`

## Acceptance criteria
- Clicking "Get My Free Solar Credit Estimate" from `/home-owners` lands on `/calculator?segment=homeowner` with **Homeowner** pre-selected.
- Clicking "Get My Detailed Calculation" does the same.
- "Check Eligibility" appears in the hero and mobile sticky bar and routes to the calculator.
- No modals open on `/home-owners`.
- Build and TypeScript checks pass.
