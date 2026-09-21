# Cession Agreement Recovery page (temporary)

## What the records actually show

Three situations are mixed together, and only two of them need a client to sign again.

**Group A — 38 projects: signed, document never produced.**
The client's signature is on record, but the cession document was never built or emailed. No re-signing needed — we rebuild the document from the signature we already hold.

**Group B — 22 projects (13 clients): marked signed, no signature on record.**
Mostly older 2024 records (Matthew Ball 9, Peter du Plessis 8, plus single projects for Hilton Hunkin, Sue Riley, Craig Scott, Karel Rautenbach, Luqmaan Vallie). No drawn signature exists, so a real signature is needed.

**Group C — 78 projects (21 clients): marked signed, no agreement at all.**
Biggest: Jonathan de Vrye (24), Marius van Rensburg (14), Dr Mohammed Essa (8), Grahame Cruickshanks (7), Justin Cackett (4). Only 2 of these clients hold a signature elsewhere. These need to sign.

Because one signature covers every project under a client, Groups B and C are roughly 34 clients — not 100 separate requests.

## On the wording to clients

It is a genuine system fault on our side, so nothing needs inventing. The honest version is also the strongest: short, apologetic, our fault, one click. I would not claim more than that, because this email sits next to a legal document and has to stand up later.

> Dear [Name],
>
> We picked up a system fault on our side: your Cession Agreement was not recorded correctly when you signed, so we do not have a valid copy on file.
>
> We're sorry for the inconvenience. Signing again takes under a minute, and one signature covers all [N] of your projects with us.
>
> [Sign Cession Agreement]
>
> Nothing else about your project changes and no action is needed beyond this.

## The admin page

A single temporary page, **Agreement Recovery**, admin only, listing every affected client across all three groups.

Each row shows: client name, email, group (A / B / C), number of projects, what is missing, last action taken, current state (Not started / Fixed / Link sent / Opened / Signed / Bounced / Failed), and a date.

Filters by group and state. Search by name or email. Select rows individually or as a whole group.

Actions available per row and in bulk:

1. **Fix silently, no email** — rebuild the missing documents from the signature on record. Group A only.
2. **Fix silently and email the document** — same, plus send the client their cession document. Group A only.
3. **Send fresh link with apology email** — issue a new signing link and send the wording above. Groups B and C.
4. **Copy link only** — get the signing link without sending anything, for clients you'd rather phone.
5. **Mark as handled** — for clients dealt with off-platform, with a note.

Every action is logged against the row with who did it and when, so the page doubles as the record of the exercise.

## Tracking and completion

- Rows move to **Signed** automatically as signatures come in; a client who signs one project clears all their projects at once.
- A header bar shows the counts: A 0/38, B 0/22, C 0/78, with a live remaining total.
- Bounced addresses are flagged rather than retried, so you can chase them by phone.
- When all three groups reach zero, the page shows a **Close and remove** action. Confirming it archives the record of the exercise and deletes the page and its menu entry — nothing permanent is left behind in the product.

## Stopping Group A recurring

An automatic hourly check finds any signed project whose cession document was never produced, builds it and emails it. This runs permanently, independent of the temporary page, so the backlog can never build up silently again.

## Technical notes

- New table `agreement_recovery_items` (client_id, group A/B/C, proposal_ids[], state, link_token, last_action, last_action_by, last_action_at, note, resolved_at) plus `agreement_recovery_events` for the per-row audit trail. RLS: admin-only via `has_role(auth.uid(),'admin')`; explicit GRANTs to authenticated and service_role.
- Population query, run once into the table and refreshable from a button:
  - A: `proposal_agreements.pdf_path is null and signature_image_url is not null`
  - B: `pdf_path is null and signature_image_url is null`
  - C: proposals in `approved`/`signed` with no `proposal_agreements` row
  all filtered on `proposals.deleted_at is null`, grouped by `client_reference_id`.
- Group A fixes reuse `sweep-agreement-documents` (already idempotent, `pdf_path is null` filter, capped batch), with an `email: false` flag added for the silent variant.
- Groups B/C: a new `issue-recovery-signing-link` edge function nominates one proposal per client, mints an invitation token with a long expiry, and sends through the existing Resend path with suppression-list filtering. Sibling projects are covered by the existing `propagate_master_agreement()` trigger on signing.
- Re-signing never edits history: new signature and new `signed_at`; any prior row is superseded and kept for audit.
- Recurrence guard: `pg_cron` hourly job posting to `sweep-agreement-documents` with the service role, alongside the existing `weekly-roundup-emails` job.
- Teardown: the close action drops the page, route, sidebar entry and the two tables in a single migration, leaving a CSV export of the completed record.
- No changes to calculations, RLS on proposals, legal document versions, or existing valid signatures.
