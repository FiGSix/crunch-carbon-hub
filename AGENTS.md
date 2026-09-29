
- Database functions start closed (default EXECUTE revoked from PUBLIC); grant only the roles that call them — anon only for public signing/calculator flows. Why: security-definer functions were callable by anyone.

- Claimable generation periods live only in `src/services/calculations/carbon/auditPeriods.ts` and its server mirror `supabase/functions/_shared/auditPeriods.ts`; every revenue, energy and PDF path derives its start date from `getEligibleStartDate(commissionDate, auditTags)`. Why: the Audit 1 / Audit 2 / 1 July 2026 cutoffs must be identical in the app, the exports and the generated documents.
- Portfolio invitations reuse each proposal's own invitation token: `send-portfolio-invitation` sends one email linking to the largest site's normal signing page, and `propagate_master_agreement` covers every sibling for that client. Why: no second signing path or token system to keep in sync.
