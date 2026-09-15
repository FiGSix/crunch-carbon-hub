## The fix

1. **Calculator submission stores a real number.**
   In `supabase/functions/send-calculator-results/index.ts` the proposal content
   currently sets `projectInfo.size` to the string `` `${systemSizeKwp} kWp` ``.
   Change it to the numeric `systemSizeKwp`, and add a separate
   `size_display: "100 kWp"` field for anywhere text is shown. Every other part
   of the system already stores this field as a number, so this brings the
   calculator in line rather than working around the guard.

2. **Make the duplicate guard tolerant of bad input.**
   `enforce_proposal_duplicate_guard` casts the size fields straight to numeric,
   so any non-numeric text crashes a save instead of just skipping the check.
   Stage an additive migration that replaces the function with a version using a
   safe numeric extraction (strip any non-numeric suffix; treat unparseable
   values as "no size" and fall back to `system_size_kwp`). The duplicate
   detection behaviour itself is unchanged. This applies when the draft is
   accepted.

3. **Verify.** Re-run a calculator submission end to end in the preview against
   the new function: a real-looking email, confirm the proposal is created, the
   full forecast unlocks and the proposal link works. Then confirm the build
   and the existing test suite still pass.

## Note on Shaun's attempts

No proposal was created for `shaun@radiant.africa` on any of the failed
attempts, so once the fix is in he can simply run the calculator again and it
will go through normally.
