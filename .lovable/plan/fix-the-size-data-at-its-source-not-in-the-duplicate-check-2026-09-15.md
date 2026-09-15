# Fix the size data at its source, not in the duplicate check

You are right. The pending database change was a workaround: it taught the duplicate check how to read messy text like "100 kWp". The better fix is to stop the messy text being written and to make the check read the number we already store correctly.

## What the data shows

Of 965 live projects:

- 855 store a clean number for system size
- 103 store a display string (mostly "10.8 kWp", "4.5 kWp") or an empty value
- 0 are missing the proper numeric size field

So every project already has a reliable numeric size. The duplicate check simply was not using it as its first choice — it read the display text first and crashed on entries like "100 kWp".

## The fix

1. Duplicate check reads the trustworthy number
   Use the dedicated numeric size field as the primary source. Only fall back to the text fields when that number is missing, and even then read it safely so a stray "kWp" never blocks a submission.

2. Stop writing display text into the size field
   Where projects are created — the proposal form, the client's own submission, the bulk uploads and the calculator — store the size as a plain number and keep the "10.8 kWp" wording in the separate display field that already exists for it.

3. Clean up the 103 existing records
   Convert their stored text to the plain number, taken from the numeric size field that is already correct, and keep the display wording where it belongs.

4. Drop the workaround
   The staged migration that made the check tolerant of text is no longer needed as the primary defence. The safe-parsing helper stays only as a last-resort fallback so no submission can ever fail on this again.

## Result

New projects save a clean number, old ones get corrected, and the duplicate check compares real numbers instead of guessing at text. No one is blocked from submitting.

## Technical notes

- `find_high_confidence_proposal_duplicate` and `enforce_proposal_duplicate_guard`: reorder the `coalesce` so `p.system_size_kwp` / `NEW.system_size_kwp` comes first, JSON text fields after, all wrapped in `public.safe_numeric` (kept as the last-resort guard against `22P02`).
- Writers to normalise: `src/services/proposals/unifiedProposalService.ts`, `src/services/proposals/clientProjectSubmission.ts`, `supabase/functions/bulk-upload-proposals`, `supabase/functions/bulk-upload-legacy-projects`, `supabase/functions/send-calculator-results` — write `projectInfo.size` as the numeric kWp value (via `normalizeToKWp`), keep the formatted string in `size_display` / `formatSystemSizeForDisplay`.
- Backfill: one data update setting `content->projectInfo->size` (and `project_info->size` where present) to `system_size_kwp::text` for the 103 rows whose current value does not match `^-?[0-9]+(\.[0-9]+)?$`, preserving the existing text into `size_display` when that key is absent.
- Verify by re-running the non-numeric count query (expect 0) and submitting a test proposal end to end.
