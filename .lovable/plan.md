# Calculator page: easier commissioning date + pre-Sept-2022 notice

Scope: the public calculator page only (`/calculator`). No changes to proposals, onboarding, or other date pickers.

## What users get

1. **Faster date picking** — the commissioning-date calendar gets month and year dropdown menus, so jumping back to 2023 (or any year) takes two taps instead of dozens of back-clicks. The picker opens on a sensible recent month.
2. **Clear eligibility notice** — if someone somehow enters a commissioning date before 15 September 2022, the form shows a clear inline message under the field: "Sadly, projects commissioned prior to 15 September 2022 do not qualify." plus a toast pop-up with the same message. The Calculate button stays blocked until a qualifying date is chosen. Dates before the cut-off remain greyed out in the calendar itself, and the existing info tooltip next to the label stays as-is.

## Technical details

- `src/pages/calculator/SystemInputPanel.tsx`
  - Calendar: add `captionLayout="dropdown"` with `startMonth={new Date(2022, 8)}` and `endMonth` = Dec 2030 (react-day-picker v9 — already installed — supports dropdown captions natively).
  - Open the popover defaulting to the selected date or a recent month (`defaultMonth`).
  - Show inline hint text under the field: "Systems commissioned before 15 September 2022 don't qualify."
- `src/pages/Calculator.tsx`
  - In `validate()`: if `commissionDate` < 2022-09-15, set `errors.commissionDate` to the "Sadly… do not qualify" message and fire `toast.error` with the same message, so even programmatic/pasted dates can't slip through.

## Verification

- Type-check + build pass.
- Playwright desktop + mobile: open the date picker, use the year dropdown to jump to 2023 in two clicks; confirm pre-cutoff dates are disabled; confirm the dropdowns render and behave on a phone-sized viewport.
