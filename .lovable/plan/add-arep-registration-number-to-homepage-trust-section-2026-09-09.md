# Add AREP registration number to homepage trust section

## What we’re changing
Update the AREP (Association for Renewable Energy Practitioners) description on the homepage so it also shows the registered non-profit company number: **Registered Non Profit Company (2025/398945/08)**.

## Why
The user wants the credibility of the legal registration number called out clearly under the AREP partner card.

## Implementation
1. Open `src/components/home/VerificationTrustSection.tsx`.
2. In the AREP card body text, add a sentence or line stating the registration number without removing the existing NPO / quality-assurance context.
3. Keep the existing brand styling and card layout intact.

## Verification
- Build passes with `bun run build`.
- Visually confirm the AREP card now reads as a registered non-profit company with the new registration number.
