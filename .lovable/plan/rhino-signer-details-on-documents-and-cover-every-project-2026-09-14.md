# Rhino: signer details on documents, and cover every project

## What is wrong today

- The signed document prints Rhino's contact details, so Juan's name and email appear in the signature block even though Naazia signed.
- Only projects that had already been sent to Rhino were covered when Naazia signed. The eight remaining Rhino projects are still drafts and were skipped, and Naazia's own project sits under a second Rhino contact record that the signature did not reach.
- Two June test entries, "rhino test test test" and "test test tets", are junk.

## What will change

### 1. Documents name the real signer

Juan stays Rhino's contact. The signature block on the document will show the person who actually signed, with their own email, taken from the verified signing record rather than the contact card. Where no signer is recorded (older records), the contact details stay as they are.

### 2. Signing covers every Rhino project

One signed cession from an authorised Rhino signer will cover:

- projects already sent to Rhino (as today),
- projects still in draft,
- any new Rhino project created afterwards, which is covered automatically at creation,
- projects filed under any contact record belonging to the same Rhino company, so Naazia's own project is included.

Each project still gets its own cession document generated from the one signature.

### 3. Catch up the existing Rhino projects

- Apply Naazia's signature to the eight Rhino drafts and to her own project, mark them signed, and generate a document for each.
- Regenerate the Houghton document with her details and email the fresh copy to her.

### 4. Delete the two June test entries

Remove "rhino test test test" and "test test tets" along with their records.

## Technical notes

- `supabase/functions/generate-signed-agreement-pdf/index.ts`: the party/signature block currently reads `client.email` (lines 241, 479) and the contact name. Resolve a signer identity first — `agreement.metadata.signatory_name` / `signatory_email`, then the master signature's metadata, then `profiles` via `signer_user_id` — and fall back to the client contact only when no signer exists.
- `supabase/functions/accept-proposal/index.ts`: persist `signatory_email` alongside `signatory_name` in the metadata of both `client_cession_signatures` and `proposal_agreements`, sourced from the authenticated signer's profile.
- `propagate_master_agreement()`: widen the status filter from `('sent','delivered','opened','viewed','stale')` to include `'draft'`, and widen client matching from "same id or same email" to "any client record linked to the same client company", keeping the existing recursion guard and the "skip proposals that already have an agreement" check. Carry `signatory_name`/`signatory_email` into the propagated metadata instead of relying on `typed_name` alone.
- New trigger on `proposals` insert: when the client's company already has a master cession signature, create the inherited `proposal_agreements` row and set the proposal signed, reusing the same propagation logic.
- Backfill via SQL for the nine outstanding Rhino proposals, then call `generate-signed-agreement-pdf` per agreement, plus a regenerate-and-send for Houghton.
- Delete the two June test proposals (`7e60ec03-fea5-4a1c-b40f-45cdb4595811`, `91257e62-db07-470a-81c7-974a2a3d1ac2`); they are already soft-deleted, so this is a hard delete of them and their dependent rows.
- Regression tests for the widened propagation and for signer-identity resolution in the PDF generator.

## Note on auto-covering drafts

With this change, a new Rhino project is signed the moment it is created, before anyone reviews its numbers. That is what you asked for and it matches a portfolio-wide cession, but it means draft projects can no longer be edited after creation (signed projects are locked). Say the word if you would rather keep drafts editable until they are issued.
