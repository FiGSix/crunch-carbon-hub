# Move projects to onboarding, straight from the proposals list

## What's wrong today

The "Bulk Move to Onboarding" pop-up only lists projects whose status is `draft` or `pending`, and only the 100 most recent. Checking the live data:

- draft: 262
- delivered: 388
- sent: 78
- stale: 56
- bounced: 7
- approved / signed: already through signing

So the pop-up shows at most 100 of the 262 drafts, and none of the 388 delivered, 78 sent, 56 stale or 7 bounced projects. "pending" isn't even a status that exists, so that filter does nothing. That is why most projects never appear.

It is also a second, disconnected list: you cannot use the search, status filter or sorting you already have on the Proposals page to find the projects you want.

## The new way

Do the selecting in the proposals list itself — no separate pop-up list to keep in sync.

1. For admins, each row in the proposals list (and each card on mobile) gets a checkbox, plus a "select all" checkbox in the header that selects everything currently shown by your filters and search.
2. Once anything is selected, a bar appears above the list: "12 selected — Move to onboarding" with a clear-selection option.
3. Clicking it opens a short confirmation showing exactly which projects will move and warning about any that can't (already signed, archived). Confirm, and they move.
4. Results are shown in the same place: how many moved, and a line for each that failed with the reason. The list refreshes in place instead of reloading the whole page.
5. Any project that hasn't been signed yet can be selected — draft, sent, delivered, stale or bounced. Already-signed projects show the checkbox disabled with "already in onboarding".

The old standalone "Bulk Move to Onboarding" button and its pop-up list get removed, since the list itself now does the job.

## Technical notes

- `src/components/proposals/ProposalList.tsx` and `list/ProposalMobileCard.tsx`: add an optional selection column/checkbox, driven by a `selectedIds` set and toggle handlers passed from the parent; render only when `userRole === "admin"`.
- New `src/components/proposals/bulk/BulkSelectionBar.tsx`: count, "Move to onboarding", clear.
- New `src/components/proposals/bulk/ConfirmMoveToOnboardingDialog.tsx`: confirmation + per-project result list; replaces `BulkMoveToOnboardingDialog.tsx` (deleted) and its ad-hoc `proposals` query.
- `ProposalsSectionOptimized.tsx` owns selection state, derived from `filteredProposals` so selections drop when filters change; calls existing `handleProposalUpdate()` on success instead of `window.location.reload()`.
- `ProposalActions.tsx`: remove the "Bulk Move to Onboarding" button and its dialog wiring.
- Reuse `useBulkMoveToOnboarding` and the `bulk-move-to-onboarding` edge function unchanged — server-side admin check, status/onboarding writes and audit logging stay exactly as they are.
- Eligibility for selection derives from the already-loaded list item (`signed_at` null), so no extra queries.
