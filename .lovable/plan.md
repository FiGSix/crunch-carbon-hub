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

## The three root causes

1. **Permission rules are re-checked for every single row.** The proposals table has two separate, overlapping read rules, and both run on every query. Each one calls `auth.uid()`, an admin check and a client-lookup function per row rather than once per query. With ~1,000 proposals this multiplies into hundreds of thousands of function calls per page load.

2. **List screens download the entire proposal record.** The onboarding lists pull each proposal's full stored content (the whole calculation and document payload) just to show a name, a date and a status. That is the single biggest contributor to the 4-second spikes.

3. **Repeated chatter.** Homepage statistics are recomputed on every visit instead of being cached briefly, and the connection health check runs thousands of extra queries that serve no user-visible purpose.

## The fix

**Database permissions (biggest win)**
- Remove the duplicate read rule on proposals so only one runs.
- Rewrite the remaining rules so identity and admin checks are evaluated once per query instead of once per row.
- Apply the same treatment to the onboarding and documents tables where the pattern repeats.
- No change to who can see what — the logic stays identical, only the evaluation changes.

**Stop over-fetching on list screens**
- Onboarding lists and the proposals list request only the fields actually displayed; the full content payload is loaded on the detail screen where it is needed.
- Cap list results with proper paging so the pages stay fast as volumes grow.

**Cut the repeated chatter**
- Cache the homepage statistics for a short window.
- Reduce the connection health ping to on-demand only.

**Verify**
- Re-run the slow-query measurement after each step and compare against the numbers above.
- Target: main screens under 300ms average, no query over 1 second.

## Technical notes

- Drop `proposals_select_policy`, keep `proposals_select_unified`, and rewrite its predicate using `(select auth.uid())`, `(select is_current_user_admin())` and `(select get_user_client_ids())` so Postgres evaluates them as initplans. Same for the update/delete policies and for `project_onboarding` / `onboarding_documents`.
- `ProjectOnboardingList.tsx` currently selects `proposals!inner(... content ...)`; replace `content` with the specific derived fields the row needs, or expose a slim view for the list.
- Run `EXPLAIN (ANALYZE, BUFFERS)` on the top two statements before and after; indexes are already comprehensive on these tables, so no new indexes are expected.
- `ConnectionManager.checkConnection` polls `profiles`; make it event-driven (on failure/reconnect) rather than on an interval.
- `get_public_homeowner_stats()` gets a React Query `staleTime` of several minutes on the homepage.

Work is sequenced permissions first, then over-fetching, then chatter, measuring after each.
