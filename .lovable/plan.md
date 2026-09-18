# Move 48 projects to Aggregator SA (Pty) Ltd

## What changes

The 48 listed projects get a new client company and contact email:

- Company: **Aggregator SA (Pty) Ltd**
- Registration number: **2021/969774/07**
- Email: **hope@artemiscapital.co.za**
- Contact person stays **Hope Segone**

The 16 other projects currently sharing the same contact record (AA Bakery, Brits en Weideman, CPI World x4, Fruit and Veg, Kempton Park, Kenton on Sea, Motorworld x2, MTN Building, Nashua House, Pepkor Logistics, Randburg Development, RTT) are left untouched on Rifuwo Energy Partners with hope@rep-energy.co.za.

## How it will be done

1. Create one new contact record for Hope Segone at Aggregator SA (Pty) Ltd with the new registration number and email, owned by the same partner who created the existing record.
2. Move the 48 named projects onto that new record, matched by exact project name.
3. Refresh the company name, registration number and email stored inside each of those 48 projects, so the details shown on the proposal and on any future agreement match the new company.
4. Re-check afterwards: confirm exactly 48 projects moved, all 48 show the new company and email, and the other 16 still show Rifuwo Energy Partners.

## Notes

- None of these 48 projects has a signature or a signed cession agreement on file, so nothing signed is affected. 15 of the 48 have been delivered by email; 33 are drafts.
- No new emails are sent as part of this change.
- If any project name in the list does not match a record exactly, it will be reported back rather than guessed at.

## Technical detail

- New row in `clients` (first_name Hope, last_name Segone, email hope@artemiscapital.co.za, company_name "Aggregator SA (Pty) Ltd", registration_number "2021/969774/07", created_by 6538aa1a-c0dc-4ce4-ab6f-bb4368d9fce1).
- `proposals.client_reference_id` repointed for the 48 titles (currently 1e3528af-b8d2-4939-82d9-705cdd7e1648).
- `proposals.content -> clientInfo` (companyName, registrationNumber, email) updated via jsonb merge for the same 48 rows; `proposal_clients` links for those proposals repointed if present.
- Applied as a data migration; verification queries run after.
