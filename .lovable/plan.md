# Simplify portfolio invitations and signing summary

## Goal
Keep the portfolio invitation and signing page focused on only two portfolio facts: the **number of projects** and the **total portfolio size**. Project-specific details remain in each proposal and its resulting Cession Agreement.

## Changes

1. **Simplify the portfolio email**
   - Keep the Crunch Carbon email styling, greeting, single signing button and decline link.
   - Show only the project count and total capacity in kWp/MWp.
   - Remove the individual project table, addresses, estimated yearly income and portfolio eligibility note.
   - Adjust the wording to explain that one signature covers the stated portfolio and that each project retains its own proposal and Cession Agreement.

2. **Simplify the live signing page**
   - Add a compact portfolio summary when the visitor arrives from a portfolio invitation.
   - State the project count and total portfolio capacity, without listing individual sites.
   - Clarify that one signature applies across the portfolio and that each project-specific Cession Agreement will carry its own proposal details.
   - Keep the existing agreement review, scroll-to-unlock and signature process unchanged.

3. **Update the dummy review page**
   - Replace the four summary figures and expandable site list with the same two-item summary used by the real flow.
   - Keep the page clearly marked as sample data and keep signing disabled.

4. **Keep the totals reliable**
   - Calculate total capacity server-side from the selected proposals.
   - Include that display-only total in the generated signing link alongside the existing project count.
   - Validate and format both values before displaying them; neither value changes which proposals are signed.

## Verification

- Confirm the simplified dummy email contains no site names, addresses, income figures or eligibility details.
- Send the updated dummy email only to `shaun@radiant.africa` and confirm the email provider accepts it.
- Open the dummy page and a portfolio-style signing link on desktop and mobile; confirm both show the same project count and total capacity.
- Confirm the normal single-project signing flow is unchanged and no real client invitation is sent.

## Technical details

- Update `send-portfolio-invitation` to render only the two aggregate values and append a validated `portfolioKwp` value to its existing acceptance URL.
- Read the existing `portfolio` count and new capacity value in `ProposalAcceptance`, rendering a small conditional portfolio context block without changing signing authorization or propagation.
- Simplify `PortfolioDemo` to mirror the final presentation.