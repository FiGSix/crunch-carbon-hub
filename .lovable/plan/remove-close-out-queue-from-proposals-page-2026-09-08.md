# Remove Close-out Queue from Proposals Page

## Goal
Remove the "Close-out queue" card from the Proposals page entirely.

## Steps
1. **Check usage** — confirm where `CloseoutQueueSection` is imported and rendered across the app.
2. **Remove from Proposals page** — delete the import and the `<CloseoutQueueSection limit={5} />` block from `src/pages/ProposalsOptimized.tsx`, including the `canArchive` guard and comment.
3. **Clean up dead code** — if the component is no longer used anywhere, delete `src/components/dashboard/sections/CloseoutQueueSection.tsx` and the `useCloseoutQueue` hook (`src/hooks/dashboard/useCloseoutQueue.ts`). Archive/reactivate actions that already exist on individual proposal rows remain untouched.
4. **Verify** — run the build and confirm the Proposals page renders without errors and no longer shows the Close-out queue card.
