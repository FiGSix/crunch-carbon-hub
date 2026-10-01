# New proposals: switch-on date must be on or after 1 July 2026

From now on, every newly created proposal must have a commissioning (switch-on) date on or after 1 July 2026. If someone enters an earlier date, they are stopped and shown your Verra 5.0 notice.

## The notice (shown word for word)

"Important eligibility update: Due to changes to Verra's Verified Carbon Standard rules, solar projects being newly onboarded to this monitoring period must have been switched on or commissioned on or after 1 July 2026. Unfortunately, projects commissioned before this date that were not already included in an earlier Crunch Carbon audit can no longer be newly added under this monitoring period. We know this may be disappointing, but this is a Verra eligibility requirement rather than a Crunch Carbon decision. If your system was commissioned on or after 1 July 2026, you can continue with the onboarding process."

## Where it applies (new projects only)

- Public calculator and quick calculator: date picker starts at 1 July 2026; earlier dates show the notice and cannot continue.
- Homeowner eligibility check (Solar Rewards pop-up).
- Partner "Create proposal" form (all phases), plus the eligibility checklist wording.
- Client "Submit a project" form.
- Bulk proposal upload: rows with earlier dates are rejected with the notice as the reason.
- Partner referral page and partner connection (outside systems sending projects in).
- Server checks repeat the same rule, so nobody can get around the screens.
- Public wording that still says "15 September 2022" (FAQ, referral page, calculator help text) is updated to 1 July 2026.

## What is NOT affected

- Existing proposals and onboarding projects keep their dates and can still be edited, signed and onboarded.
- Projects already in Audit 1 or Audit 2 keep their original periods.
- The legacy project upload (used to load already-audited projects) keeps the 15 September 2022 minimum.

## Technical details

- Add `NEW_PROJECT_MIN_COMMISSION_DATE` (2026-07-01) and the notice text to `src/utils/dateValidation.ts`, with a server mirror in `supabase/functions/_shared/` (record the rule in AGENTS.md alongside the audit-period rule).
- Replace hard-coded `2022-09-15` checks in: Calculator.tsx, SystemInputPanel.tsx, QuickCalcForm.tsx, EligibilityModal.tsx, ProjectInfoForm.tsx (+ DateRejectionDialog showing the notice), EligibilityCriteriaList.tsx, onboardingSchema.ts (new-project path only), PartnerReferralLandingPage.tsx, WhyChooseUsFAQ.tsx.
- Server: send-calculator-results, send-eligibility-proposal, bulk-upload-proposals, create-referral-proposal, _shared/partner-validation.ts return 400 with code `COMMISSION_BEFORE_VERRA_CUTOFF` and the notice.
- Edit flows check only when the proposal is new (no id); OnboardingTab and bulk-upload-legacy-projects unchanged.
- Verify in the browser: calculator with 10 March 2023 shows the notice; 1 August 2026 proceeds.
