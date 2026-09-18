# Plan: CSV export of proposals (admin only)

## What you get

A new **Export CSV** button on the Proposals page, visible to admins only. It downloads a spreadsheet of every proposal currently shown in the list — so your existing search, status, and advanced filters decide what lands in the file. Filter to "delivered" and you export only delivered; clear the filters and you export everything.

This mirrors how the onboarding CSV export already works (exports the rows you can see), so the two admin exports behave the same way.

## What's in each row

One row per proposal, with plain-English column headers:

- **Project:** proposal title, proposal ID
- **Client:** client name, email, company name, company registration number
- **Agent:** agent name and email (who created/owns the proposal)
- **System:** size (kWp), annual energy (kWh), estimated carbon credits (t CO₂)
- **Commercials:** client share %, agent commission %
- **Status & dates:** current status, created date, invitation sent date, invitation viewed date, signed date, archived date
- **Engagement:** last email event (delivered/opened/clicked/bounced), engagement count, last engagement date
- **Onboarding flags:** signed, submitted for review, admin validated, Audit Ready

Dates as YYYY-MM-DD, blanks for missing values, and proper escaping so commas in names don't break the file. No internal IDs beyond the proposal ID, no sensitive credential data.

## How it's built (technical)

- New `src/lib/proposals/exportProposalsCsv.ts`, modelled on the existing `exportOnboardingCsv.ts` (same CSV escaping, date formatting, and download helper style). It takes the already-fetched, already-filtered proposal list from the page — no extra database query, so RLS and role checks are inherited from the existing `useProposals` fetch.
- For fields not already loaded in the list (company name/registration), reuse the existing client-resolution helpers (`resolveClientInfo`, content snapshots) rather than adding new queries; fall back to blank when absent.
- New small `ExportProposalsButton` component (like `ExportUsersButton`) placed in `ProposalsSectionOptimized.tsx`, next to the Refresh button in the card header — rendered only when `userRole === 'admin'`.
- Filename: `proposals-export-YYYY-MM-DD.csv`.

## Verification

- Type-check and build pass.
- Unit-style check of the CSV builder against sample rows (commas/quotes in names, missing dates, null numbers).
- Confirm the button appears for admins only and is hidden for agents and clients.

## Out of scope

- No changes to proposal data, statuses, emails, or the onboarding export.
- No new filters or columns on the proposals list itself.
