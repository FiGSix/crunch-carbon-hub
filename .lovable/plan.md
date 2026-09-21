# Why re-signed clients are not clearing off the Recovery page

## What the records show

**Jared Groom (Weylandts) did sign again — this morning at 12:37.** His signature and the cession document are on record for "Weylandts Epping DC Phase 1". But his other project, "Weylandts Green Point", still has no agreement, so he correctly stays on the list. The signature did not carry across to it.

**The reason:** when someone signs, the platform copies that signature onto their other projects — but only onto projects still sitting in a pre-signature state (draft, sent, delivered, opened). Every project on this recovery list is already marked approved or signed, which is exactly the problem we are fixing. So the copy step skips them all. One client, one signature, and only one project gets fixed.

**The two Justins have not actually signed.** Neither Justin Cackett (4 projects) nor Justin Driemeyer (Zenco Farming) has any new signature on record — no signature, no agreement, nothing recorded since their apology emails went out at 12:13. Whatever they saw, nothing was saved. This needs the signing attempt itself to be traced before assuming it worked.

**Rebuild is working correctly.** It is reporting the truth: these clients still have projects without agreements. Nothing is broken about the button.

## What to do

**1. Make one signature cover all the client's projects again**

Extend the copy step so it also covers projects already marked approved or signed that have no agreement on record — the exact backlog case. Projects that already hold a valid signed agreement are never touched, never overwritten, and history is never edited. This is the root fix: without it, every client on the list would have to sign once per project.

**2. Backfill Jared Groom**

Once the copy step is corrected, apply it to the signatures already captured — starting with Jared's Green Point project, which then produces its document automatically and drops him off the list.

**3. Find out what happened to the two Justins**

Trace their signing attempts through the acceptance records and email activity before contacting them again. If their link failed for a technical reason, that has to be fixed first, otherwise a second email produces the same result. If they simply did not finish, the page should say "Link opened, not signed" rather than "Link sent".

**4. Show real progress on the page**

Today a row stays on "Link sent" until every last project clears. Add a live count per row — "3 of 4 done" — and move the row to Signed automatically when the client's signature arrives, so it is obvious at a glance who acted and who did not.

## Technical notes

- `propagate_master_agreement()` filters siblings on `p.status IN ('draft','sent','delivered','opened','viewed','stale')`; recovery-group proposals are `approved`/`signed`, so the `INSERT ... SELECT` matches nothing. Widen the filter to include `approved`/`signed` while keeping the `NOT EXISTS (select 1 from proposal_agreements ...)` guard, which already prevents overwriting valid agreements. Same widening for `inherit_master_agreement_on_insert()` is not needed (insert-time path).
- Backfill: for each client in `agreement_recovery_items` holding a live `client_cession_signatures` row, insert propagated `proposal_agreements` rows for their agreement-less proposals using the same column mapping as the trigger (`source: master_agreement_propagation`), then let the hourly `sweep-agreement-documents` job produce the PDFs.
- Justin Cackett (`e269d2b7`) and Justin Driemeyer (`2491c839`) have no `client_cession_signatures` row at all — inspect `accept-proposal` logs and `client_access_audit` for their nominated proposals (`6a204368`, `46318574`) before re-sending.
- Recovery page: recompute `state`/`resolved_at` per row inside `refresh_agreement_recovery()` from remaining affected proposals, and add a `remaining_count` so the table can show partial progress.
- No change to signature validity, legal document versions, RLS, or existing agreements.
