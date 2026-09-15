# Calculator page redesign

Replace the current `/calculator` page with a warmer, step-by-step lead-magnet flow. The new page tells a short story: discover what your solar system could earn, unlock the full forecast with an email, and receive a personal proposal that can be signed and onboarded through the existing cession-agreement flow.

## Goals

- Make the first estimate instant and visually rewarding: one headline Rand income number with no contact details.
- Capture the email only after the user has seen value, in exchange for the year-by-year forecast and a personal proposal preview.
- Add two small inputs that improve accuracy and segmentation: **homeowner / business** toggle and **province**.
- Use the real client-share tiering (`UnifiedCarbonService.getClientSharePercentage`) and per-province solar yield instead of the flat 60.2% / national-average assumptions.
- Keep the visual identity consistent with the existing site: white backgrounds, `crunch-yellow` / `crunch-black`, Inter font, shadcn components, Framer Motion.
- Preserve SEO value: keep the same Helmet title/meta and `/calculator` canonical URL.

## What will change

- `src/pages/Calculator.tsx` becomes the new multi-step orchestrator.
- `src/pages/calculator/CalculatorForm.tsx`, `CalculationResults.tsx`, `FeaturesSection.tsx`, and `CTASection.tsx` are removed or collapsed into smaller, single-purpose components.
- New components in `src/pages/calculator/`: `SystemInputPanel`, `HeadlineResultPanel`, `EmailGatePanel`, `FullForecastPanel`, `ProposalPreviewPanel`, `HowItWorksSection`, and a small final CTA.
- Calculation logic stays in `UnifiedCarbonService` but is called with province-specific yield and tiered share.
- `send-calculator-results` edge function receives segment + province and creates/updates the client record and proposal with those fields.
- The existing proposal-acceptance, signing, and onboarding flows remain unchanged; the calculator simply hands off to them.

## Out of scope for this plan

- Changing the rest of the site visual style or the logo.
- Replacing the existing WhatsApp referral mechanism.
- Modifying the cession agreement PDF, signature logic, or onboarding schema.
- Adding a new database migration; province and segment are stored in existing JSON/content columns for now.
