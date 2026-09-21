# Why re-signed clients are not clearing off the Recovery page

## What the records show

**Jared Groom (Weylandts) did sign again — this morning at 12:37.** His signature and the cession document are on record for "Weylandts Epping DC Phase 1". But his other project, "Weylandts Green Point", still has no agreement, so he correctly stays on the list. The signature did not carry across to it.

**The reason:** when someone signs, the platform copies that signature onto their other projects — but only onto projects still sitting in a pre-signature state (draft, sent, delivered, opened). Every project on this recovery list is already marked approved or signed, which is exactly the problem we are fixing. So the copy step skips them all. One client, one signature, and only one project gets fixed.

**The two Justins have not actually signed.** Neither Justin Cackett (4 projects) nor Justin Driemeyer (Zenco Farming) has any new signature on record — no signature, no agreement, nothing recorded since their apology emails went out at 12:13. Whatever they saw, nothing was saved.

**Rebuild is working correctly.** It is reporting the truth: these clients still have projects without agreements.

## What to build

**1. One signature covers every project, signed or not**

Extend the copy step so a client's signature is applied to all of their projects that have no valid agreement — including those already marked approved or signed. Projects that already hold a valid signed agreement with a document are never touched.

**2. Keep each project's original date**

Where a project already has an original signing date on record, the rebuilt agreement carries that date, so the paperwork matches when the client actually committed. Where there is no original date, the new signing date is used. The signature itself and the audit trail record the real date it was captured, so nothing is misrepresented — the document shows the effective date, the record shows both.

**3. Rebuild and store the document for every project**

After the signature is applied, each affected project gets its cession document generated and stored against it, using the date rules above. Documents are produced for signed and unsigned projects alike, so every project ends with a complete, downloadable agreement.

**4. Backfill the clients who already signed**

Apply the above to signatures already captured — Jared Groom first, which clears his remaining project immediately — then to every other client on the list who holds a signature.

**5. Get Justin Cackett and the remaining clients signed**

Trace the two Justins' signing attempts first, so a second email doesn't hit the same fault. Once each client signs, all of their projects are re-signed, dated and documented automatically by steps 1–3 — no per-project action.

**6. Show real progress on the page**

Each row shows how many of the client's projects are done ("3 of 4"), and moves to Signed on its own once the client's signature arrives and everything is rebuilt.

## Technical notes

- Root cause: `propagate_master_agreement()` filters siblings on `p.status IN ('draft','sent','delivered','opened','viewed','stale')`, so `approved`/`signed` backlog proposals match nothing. Widen the filter to include `approved` and `signed`, keeping the `NOT EXISTS (select 1 from proposal_agreements pa where pa.proposal_id = p.id)` guard so valid agreements are never overwritten. Also treat rows with `superseded_at is not null` as absent.
- Effective date: propagated `proposal_agreements.signed_at` takes `coalesce(p.signed_at, NEW.signed_at)` per proposal rather than a single date for all; `metadata` records `actual_signature_captured_at` (the real capture time), `backdated: true/false` and `origin_agreement_id`, so the audit trail keeps both dates. The PDF renders the effective date.
- Backfill migration: for each `agreement_recovery_items` client with a live `client_cession_signatures` row, insert propagated agreement rows for their agreement-less proposals using the same mapping, then generate documents via `sweep-agreement-documents` (already idempotent on `pdf_path is null`, capped batch, hourly cron in place).
- Justin Cackett (`e269d2b7`, proposals `4f9162a4`, `8e0020e9`, `5f74ee13`, `6a204368`, plus `bae63da6` delivered) and Justin Driemeyer (`2491c839`, proposal `46318574`) have no `client_cession_signatures` row — inspect `accept-proposal` logs and `client_access_audit` for the nominated proposals before re-sending.
- Recovery page: `refresh_agreement_recovery()` recomputes `state`/`resolved_at` per row from remaining affected proposals and returns a `remaining_count`/`total_count` pair for the progress column.
- No change to existing valid agreements, signature validity, legal document versions, RLS, or calculations.
