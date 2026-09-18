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

## Impact on the platform

- **Who sees what does not change.** The combined effect of the two proposal rules is reproduced exactly in the one rule that remains: own projects, team members' projects, client-owned projects, client-company colleagues' projects, admins, and invitation-link access. Before applying it, I compare the list of visible projects for an admin, an agent, a super partner and a client against today's results, and only keep the change if the lists match.
- **Expected gain:** the heaviest screens (proposals, onboarding lists, follow-ups) should drop from roughly half a second to a second down to well under a third of a second, with the 3–4 second spikes gone.
- **Risk of the permission change:** if a rule is mis-transcribed, someone could see too few or too many projects. This is why it is verified per role before and after, and it is reversible in one step.
- **Risk of the list-screen change:** a column could lose a value if it secretly depended on the full stored content. Each list column is checked against a real row before and after.
- **No downtime, no data changes, no emails sent.** Nothing about proposals, signatures, onboarding or the path to Audit Ready is touched.


## Technical notes

- Drop `proposals_select_policy`, keep `proposals_select_unified`, and rewrite its predicate using `(select auth.uid())`, `(select is_current_user_admin())` and `(select get_user_client_ids())` so Postgres evaluates them as initplans. Same for the update/delete policies and for `project_onboarding` / `onboarding_documents`.
- `ProjectOnboardingList.tsx` currently selects `proposals!inner(... content ...)`; replace `content` with the specific derived fields the row needs, or expose a slim view for the list.
- Run `EXPLAIN (ANALYZE, BUFFERS)` on the top two statements before and after; indexes are already comprehensive on these tables, so no new indexes are expected.
- `ConnectionManager.checkConnection` polls `profiles`; make it event-driven (on failure/reconnect) rather than on an interval.
- `get_public_homeowner_stats()` gets a React Query `staleTime` of several minutes on the homepage.

Work is sequenced permissions first, then over-fetching, then chatter, measuring after each.
