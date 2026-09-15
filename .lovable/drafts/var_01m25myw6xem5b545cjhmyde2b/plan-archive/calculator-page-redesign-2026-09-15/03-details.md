# Implementation details

## New component structure

```text
src/pages/
  Calculator.tsx                      # orchestrator, state machine, Helmet
  calculator/
    HeroSection.tsx                   # redesigned hero, same route/SEO
    SystemInputPanel.tsx            # segment toggle, size, province, date
    HeadlineResultPanel.tsx         # big Rand number + 2–3 supporting stats
    EmailGatePanel.tsx              # name/email inline form
    FullForecastPanel.tsx           # year-by-year table + assumptions
    ProposalPreviewPanel.tsx        # document card + next-step button
    HowItWorksSection.tsx           # 4-step roadmap
    FinalCTASection.tsx             # compact closing prompt
```

## State machine

A small internal state in `Calculator.tsx` drives the panels:

1. `input` — show `SystemInputPanel` and `HeroSection`.
2. `headline` — show `HeadlineResultPanel` above the still-visible input.
3. `gate` — show `EmailGatePanel`; headline stays visible above it.
4. `forecast` — show `FullForecastPanel` and `ProposalPreviewPanel`; email gate collapsed.
5. `onboarding` — link off to `/register` or the proposal-acceptance route (existing flow).

Only `input` and `headline` are visible before an email is submitted.

## Inputs and validation

- **Segment** (Homeowner / Business): default Homeowner. Stored in the client record and proposal content.
- **System size**: free-text `kWp` or `MWp` input with the existing `normalizeToKWp` helper; max 15 000 kWp. Keep the current "Number of panels × panel wattage" quick helper as an optional disclosure.
- **Province**: `Select` with the nine South African provinces, stored and used for `getYieldForProvince`. Required.
- **Commissioning date**: blank by default with placeholder "Select the date your system was installed"; min 15 September 2022, max 31 December 2030.

Validation runs on the Calculate button; invalid fields show shadcn-style error text.

## Calculation changes

- Call `UnifiedCarbonService.getClientSharePercentage(systemSizeKwp)` instead of the hard-coded `60.20%`.
- Call `getYieldForProvince(province)` instead of the national-average `1,642.5 kWh/kWp/year`.
- Annual generation = size × province yield.
- Carbon credits = generation ÷ 1,000 × `EMISSION_FACTOR` (`1.0334`).
- Headline annual income = carbon credits × current-year market price × client share.
- `calculateRevenueByYear` builds the 2025–2030 table with first-year pro-rating.
- Supporting stats below the headline: carbon credits per year, coal avoided, trees equivalent.

## Email gate and proposal creation

- The `EmailGatePanel` shows a short value statement: "Get your full revenue forecast and a personalised proposal in your inbox." Fields: first name and email.
- On submit, call `supabase.functions.invoke('send-calculator-results')` with:
  - `email`, `name`, `systemSizeKwp`, `commissioningDate` (ISO string)
  - `segment` (homeowner/business), `province`
  - `referralCode` from `localStorage.getItem('referralCode')`
  - `userAgent`
- The edge function creates/updates a client row and generates a proposal in the same way it does today, but stores `segment` and `province` in `content`.
- After success, the UI moves to `forecast` and shows the `ProposalPreviewPanel` with a link to view the proposal.

## Proposal preview panel

- Card styled like a signed document preview: icon, proposal reference, system size, commissioning date, estimated annual income, and a primary button to "Review & sign your proposal".
- Secondary action: "Email me the PDF" reuses the existing calculator-results email.
- The link routes to the existing proposal-acceptance page using the generated proposal token.

## How it works section

Four numbered steps rendered as simple horizontal cards on desktop and a vertical stack on mobile:

1. Discover the possibility — instant estimate.
2. Make your proposal — email unlocks the forecast.
3. Sign your cession agreement — digital signature, no paperwork.
4. Onboard your system — submit site details and inverter access.

Copy should set expectations without over-promising: onboarding requires documents, installer details, and inverter data access.

## Files to modify or delete

- **Delete or empty:**
  - `src/pages/calculator/CalculatorForm.tsx`
  - `src/pages/calculator/CalculationResults.tsx`
  - `src/pages/calculator/FeaturesSection.tsx`
  - `src/pages/calculator/CTASection.tsx`
- **Modify:**
  - `src/pages/Calculator.tsx` — rewrite as the new orchestrator.
  - `supabase/functions/send-calculator-results/index.ts` — accept `segment` and `province`, persist to client/proposal.
- **Leave untouched:**
  - `src/pages/calculator/FeatureCard.tsx` and `ResultCard.tsx` can be deleted unless reused in the new supporting-stats row.
  - All existing signing, PDF, and onboarding flows.

## Accessibility and performance

- Respect `prefers-reduced-motion`: disable the number count-up and panel slide-ins when the user has reduced motion enabled.
- Use `aria-live="polite"` on the result panel so screen readers announce the headline number.
- Keep the existing lazy-loaded route; no new dependencies.
- Number count-up animation uses Framer Motion or a small requestAnimationFrame helper (no new library).

## Testing checklist

- [ ] Estimate updates immediately when province or segment changes.
- [ ] Headline number matches `UnifiedCarbonService` with tiered share and province yield.
- [ ] Email gate blocks the full forecast until submitted.
- [ ] Submitting the email creates a client and proposal and sends the results email.
- [ ] Proposal preview link opens the existing acceptance page.
- [ ] Invalid system size, missing province, and missing date show clear errors.
- [ ] Page passes `bun run build` with no errors.
- [ ] Mobile viewport keeps the single-column panel flow.
