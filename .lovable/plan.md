# Getting missing Cession Agreements signed

## What the records actually show

Three different situations are mixed together right now, and only one of them needs a client to sign again.

**Group A — 38 projects: signed, document never produced.**
The client's signature is on record, but the cession document was never built or emailed. Nothing needs re-signing. We generate the document from the signature we already hold and send it.

**Group B — 22 projects (13 clients): marked signed, no signature on record.**
Mostly older records from 2024 (Matthew Ball 9, Peter du Plessis 8, plus single projects for Hilton Hunkin, Sue Riley, Craig Scott, Karel Rautenbach, Luqmaan Vallie). These carry no drawn signature, so a real signature is needed.

**Group C — 78 projects (21 clients): marked signed, no agreement at all.**
Largest group. Biggest: Jonathan de Vrye (24), Marius van Rensburg (14), Dr Mohammed Essa (8), Grahame Cruickshanks (7), Justin Cackett (4). Only 2 of these clients hold a signature elsewhere on the platform. These need to sign.

So the real list to contact is Groups B and C — about 34 clients covering 100 projects. And because one signature covers every project under that client, most of them sign once, not 30 times.

## On the wording to clients

It is a genuine system fault — the agreement record was never completed on our side — so we do not need to invent anything. The honest version is also the strongest one: short, apologetic, our fault, one click to fix. I would not claim anything beyond that, because the email lands next to a legal document and the record has to stand up later.

Proposed wording:

> Dear [Name],
>
> We picked up a system fault on our side: your Cession Agreement was not recorded correctly when you signed, so we do not have a valid copy on file.
>
> We're sorry for the inconvenience. Signing again takes under a minute, and one signature covers all [N] of your projects with us.
>
> [Sign Cession Agreement]
>
> Nothing else about your project changes and no action is needed beyond this.

## What I propose to do

1. **Fix Group A silently** — regenerate and email the 38 missing documents from the signatures already on record. No client contact needed.
2. **Build the list** — an admin screen showing every client in Groups B and C: name, email, project count, what is missing, whether they have been contacted. You confirm or trim the list before anything goes out.
3. **Issue fresh signing links** — one valid link per client, pointing at their main project, with a long expiry.
4. **Send the apology email** — wording above, sent per client (not per project), on your go-ahead. Sent in small batches so we can watch delivery.
5. **Track it** — the same screen shows sent / opened / signed, so you can chase the stragglers. Once a client signs, all their projects flip to signed with their own cession documents automatically.
6. **Stop it recurring** — an hourly check that catches any signed project whose document was never produced and finishes it, so Group A can never build up silently again.

## Technical notes

- Group A: existing `sweep-agreement-documents` already handles `pdf_path is null` rows idempotently; run it in batches, then schedule it hourly via `pg_cron` with the service role.
- Group B/C detection queries: agreements with `pdf_path is null` split on `signature_image_url is null`; and proposals in `approved`/`signed` with no `proposal_agreements` row. Persist the working list in a small `agreement_resign_campaign` table (client_id, reason, status, link_token, sent_at, signed_at) so progress survives page reloads and re-runs.
- Re-signing must not fabricate history: Group B/C rows get a new signature and new `signed_at`; existing rows are superseded, never edited in place. Keep the original record for audit.
- New links are issued via the existing invitation-token mechanism on one nominated proposal per client; propagation to siblings is already handled by `propagate_master_agreement()`.
- Email goes through the existing Resend send path with the suppression-list filter, so previously bounced addresses are excluded and surfaced in the list for manual follow-up.
- No changes to calculations, RLS, legal document versions, or existing valid signatures.
