# Why the platform feels slow, and how to fix it

The slowness is coming from the database, not the website code. Pages are already split so each screen downloads only what it needs. But the queries behind the main screens are averaging 0.4–0.8 seconds each, with spikes over 4 seconds — and most screens fire several of them.

## What the measurements show

Slowest work in the last period (average time per call):

- Proposals list: 2,707 calls, 469ms average, 3.0s worst case
- Onboarding project lists (four variants): 435–792 calls each, 508–765ms average, 4.5s worst case
- Follow-up reminder list: 600 calls, 676ms average
- Document lookups for onboarding: 590 calls, 398ms average
- Homepage statistics: 1,491 calls, 82ms average, never cached
- A connection "health ping" against the profiles table: 9,338 calls

## When this started, and why it wasn't noticed

Nothing broke suddenly — this crept in.

- 6 Nov 2025: the single proposal visibility rule (`proposals_select_unified`) was created.
- 11 Dec 2025: a second visibility rule (`proposals_select_policy`) was added to give client-company teams shared access.
- 12 Dec 2025: that second rule was extended again with company-client lookups.

From 11 December the database has been applying two overlapping rules to every proposal row on every read, instead of one. At the time there were a few hundred proposals and light traffic, so the extra work was invisible. The cost grows with rows multiplied by visits — and the platform has since reached roughly 965 proposals, 1,354 visitors and 7,747 page views a week. Same rules, far more rows and traffic, so the delay has become visible now.

## The three root causes

1. **Permission rules are re-checked for every single row.** Two overlapping read rules both run on every query. Each calls the current-user lookup, an admin check and a client-lookup function once per row rather than once per query. Across ~1,000 proposals that is hundreds of thousands of function calls per page load.

2. **List screens download the entire proposal record.** The onboarding lists pull each proposal's full stored content (the whole calculation and document payload) just to show a name, a date and a status. That is the single biggest contributor to the 4-second spikes.

3. **Repeated chatter.** Homepage statistics are recomputed on every visit instead of being cached briefly, and the connection health check runs thousands of extra queries that serve no user-visible purpose.


## The fix, ordered from zero-risk to highest

**Step 1 — Zero-risk speed-ups (no visibility, no data, no screen content changes)**
- Cache the homepage statistics for a few minutes.
- Stop the constant background connection ping; run it only when a request actually fails.
- Add proper paging limits to the big lists.
- These alone remove thousands of database calls a week. Measure the gain before going further.

**Step 2 — Stop the lists downloading the whole proposal (safe, provable)**
- Before changing anything, I list every field each list screen actually reads out of the stored content. If any column genuinely needs it, that column keeps its data — it is fetched from a small derived field instead, not dropped.
- The change is verified by loading the same screen with old and new data side by side and comparing every row and column. If a single cell differs, the change does not ship.
- If anything is ambiguous, this step is skipped for that screen rather than guessed at.

**Step 3 — The permission rules (only after 1 and 2 are proven, and only with your go-ahead)**
- This is the biggest win but it touches who can see what, so it gets its own approval and its own session.
- Method: build the replacement rule alongside the current ones, then run an automated comparison that lists, for every single user account on the platform, the exact set of projects visible today versus under the new rule. Not a sample — all of them.
- The change is only applied if the two lists are identical for every user. Any difference at all stops it.
- The old rules are kept in a one-line rollback migration, so reverting is immediate.
- If you would rather not touch permissions at all, say so — steps 1 and 2 still give a real improvement, just a smaller one.

## Impact on the platform

- **Expected gain:** steps 1 and 2 should take the heaviest screens from 0.5–0.8 seconds down to roughly 0.2–0.3 seconds and remove the 3–4 second spikes. Step 3 is what keeps it fast as volumes keep growing.
- **On your two risk concerns:** both are now handled by proving equivalence rather than by promising care. The permission change is compared across every user account before it applies, and the list change is compared cell by cell. Neither ships on a judgement call.
- **No downtime, no data changes, no emails sent.** Proposals, signatures, onboarding and the path to Audit Ready are untouched throughout.
- **If we do nothing:** the platform keeps getting slower in proportion to growth — the underlying cost is rows multiplied by visits, and both are rising.

## Technical notes

- Step 1: `get_public_homeowner_stats()` gets a React Query `staleTime`; `ConnectionManager.checkConnection` becomes failure-triggered instead of interval-polled; explicit `.range()` limits on the proposal and onboarding list queries.
- Step 2: `ProjectOnboardingList.tsx` and `ProposalsDataService.getProposals` both select `content`; audit `dataTransformer.ts` / `simplifiedTransformers.ts` for every field read out of it, then replace with narrowed selects or a slim list view.
- Step 3: consolidate `proposals_select_policy` into `proposals_select_unified`, wrapping `auth.uid()`, `is_current_user_admin()`, `get_user_client_ids()` and `get_user_client_company_client_ids()` in `(select ...)` so they evaluate as initplans once per query. Equivalence harness: for each `auth.users` row, compare `old_policy_expr` vs `new_policy_expr` over all proposals with the user id substituted, and assert an empty symmetric difference.
- `EXPLAIN (ANALYZE, BUFFERS)` before and after each step; indexes on these tables are already comprehensive, so no new indexes are expected.

