# Raise the inverter quantity limit in onboarding from 20 to 100

The inverter count on the Onboarding "Inverters" section is capped at 20 in two places — the validation schema and the number input — which blocks projects with more inverters. Both move to 100 so large sites can be captured accurately.

## What changes

- `src/lib/validation/onboardingSchema.ts`
  - Zod rule: `.max(20, "Maximum 20 inverters")` → `.max(100, "Maximum 100 inverters")`
  - `validateField` case for `inverter_quantity`: `qty > 20` → `qty > 100` with the matching message
- `src/pages/ProjectOnboardingDetail/OnboardingTab.tsx`
  - Number input `max="20"` → `max="100"`
  - On-change guard `val <= 20` → `val <= 100`

The per-inverter detail rows already render dynamically from the quantity, so nothing else needs to change for larger counts.

## Verification

- Confirm no other spot (server-side checks, CSV export, follow-up logic) enforces 20 — the shared outstanding-info helper only checks `qty >= 1`, so it is already compatible.
- Run the validation unit tests and the build.
