# Fix: calculator fails with "Failed to create proposal"

## What is actually happening

Shaun's first calculator run this morning worked — an estimate was created at 07:45 and the email was sent. Every attempt after that failed.

The reason is the duplicate-project protection we added to stop two installers claiming the same site. It sees "same person + same project name + same system size" and blocks the save. A public calculator estimate always looks exactly like that: the same person, the generic name "Solar Project - 100 kWp", the same size. So the second time anyone runs the calculator with the same numbers, their estimate is refused and they see "Failed to create proposal".

(The earlier crash on the size text — `invalid input syntax for type numeric: "100 kWp"` — is gone since this morning's fix. This is a different, remaining problem.)

The calculator already tries to reuse a recent identical estimate instead of creating a new one, but it only matches on an exact project-name and exact size match within 15 minutes, so small differences slip past it and hit the block.

## What we will change

1. **Repeat estimates return the existing one instead of failing.** When someone runs the calculator again and the estimate matches one already on file for that email — the same size within a small tolerance, created recently — they get their existing report and secure link back, with the email sent again. No error, no duplicate record.

2. **A genuinely different estimate is allowed through.** If the person changes the system size or date meaningfully, a new estimate is created. Public self-service estimates are not installer site claims, so the duplicate-claim protection should not block a person from estimating their own roof twice. The protection stays fully in force for partner- and admin-created projects and for bulk uploads.

3. **If the block is still hit, the message is honest and useful.** Instead of "Failed to create proposal", the person is pointed to their existing report rather than a dead end.

## Technical notes

- `supabase/functions/send-calculator-results/index.ts`:
  - Widen the reuse lookup: match on `client_reference_id` plus `system_size_kwp` within the same tolerance the duplicate guard uses (`greatest(0.5, size * 0.005)`), over a longer window (24 hours), ignoring the exact title; order newest first, reuse `id` + `invitation_token`.
  - Mark calculator inserts as self-service so the guard does not apply to them — set a flag in `project_info`/`content` (e.g. `source: 'public_calculator'`) and skip the guard for those rows.
  - Wrap the insert so a `P0001 DUPLICATE_REVIEW_REQUIRED` falls back to fetching the matching existing proposal for that client and returning its id + token, rather than a 500.
- Database: extend `enforce_proposal_duplicate_guard()` to return early when the incoming row is a public-calculator lead (source flag) — no change to the partner/admin path, and `find_high_confidence_proposal_duplicate` is untouched so the admin duplicate review screen behaves as before.
- Verify by running the calculator twice with identical inputs (expect the same report both times, no error) and once with a clearly different size (expect a new report), then confirm partner proposal submission still blocks a true duplicate.
