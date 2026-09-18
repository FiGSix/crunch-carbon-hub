# Move the Dave Wardle project onto the correct Dave Wardle record

## What I found

There are two Dave Wardle contact records (neither has a login account):

- **Keep**: `dave@thomasriver.com`, phone 0826656515, created 23 March 2026, linked to the Thomas River client company.
- **Remove**: `southisdownhill@gmail.com`, created today at 13:04 (SAST), no company, no phone.

One project, **"David Wardle"**, is attached to the record being removed. It was signed today at 13:08 (electronically, by Nicole Smith of Gridvolt via the acceptance link) and already has a signed agreement, a signature record and an onboarding record.

The proposal already lists the `dave@thomasriver.com` record as an additional client on it, so both records are currently tangled around the same project.

## The change

1. Point the "David Wardle" project at the `dave@thomasriver.com` record.
2. Move the signature record and the signed-agreement history across to that record, so the signing date and agreement stay attached to the project and nothing in the audit trail is lost.
3. Update the client details stored inside the project (name, email, phone) so it shows `dave@thomasriver.com` instead of the gmail address.
4. Remove the duplicate entry for the project's extra-client list so Dave isn't listed twice.
5. Delete the `southisdownhill@gmail.com` contact record once nothing points at it any more.

The onboarding record stays exactly as it is — it hangs off the project, not the contact, so the path to Audit Ready is unaffected. No emails will be sent.

## Regenerate the signed agreement

The signed PDF generated today shows `southisdownhill@gmail.com`. After the move I'll regenerate it so the correct email and contact details appear, keeping the original signature image, signing date, witnesses and agreement version. The regenerated document replaces the stored copy on the project; no email is sent to anyone.

## Technical notes

- `proposals.client_reference_id` → `38b8b547-6513-4f78-a630-8c2ef771e945`; refresh `content->'clientInfo'` (email, phone, name).
- `client_cession_signatures.client_id` (row `de11b7ef…`) → the kept client; carry `cession_signed_at` and `first_agreement_id` (`2234091b…`) onto `clients.38b8b547…`.
- Delete the `proposal_clients` row `6e1571d3…` (duplicate of the now-primary client), then delete `clients.276df296-0710-4b6b-9ad0-54291b40b75a`.
- Verify afterwards that no rows in `proposals`, `client_cession_signatures`, `proposal_clients`, `agent_leads` or `client_company_members` still reference the deleted ID.
- Data-only change applied as a migration; no application code is touched.
