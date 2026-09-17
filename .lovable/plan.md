# CC additional clients on proposal invitation emails

## Problem
When a partner edits a proposal and adds extra clients (e.g. Mall @ Red), those
additional clients are stored on the proposal but never receive the invitation
email. "Send invite" and "Resend invite" resolve a single primary email address
and send exactly one email (`useProposalInvitations.ts` → `send-proposal-invitation`).

## Confirmed current state
- `src/components/proposals/hooks/useProposalInvitations.ts` extracts only
  `content.clientInfo.email` (or the live `clients` record) and invokes
  `send-proposal-invitation` once with a single `clientEmail`. No reference to
  `additionalClients` anywhere in the hook, the invite button, or the edge function.
- `supabase/functions/send-proposal-invitation/types.ts` has no CC-recipients field;
  the only CC today is the agent's own email.
- Additional clients live at `content.clientInfo.additionalClients[]` with
  `firstName`, `lastName`, `email` (per `src/types/proposals.ts`).

## Decisions (from the user)
- Additional clients are **CC'd on the same email** as the primary client — one
  email, one tracked thread.
- **Only the primary client signs.** CC'd clients can review the proposal but the
  signing journey stays with the primary.

## Plan

### 1. Frontend: collect and pass CC recipients
- In `useProposalInvitations.ts`, after resolving the primary email, read
  `content.clientInfo.additionalClients`, take entries with a valid non-empty
  email, trim/lowercase them, drop any that match the primary email (and the
  sender's own email), and pass them as `ccEmails: string[]` (plus
  `ccNames: string[]` for logging) in the invoke body.
- Apply the same suppression/block-list check to each CC address; silently drop
  suppressed CCs but never block the send because of a CC.
- No UI changes — "Send invite" / "Resend invite" keep working as-is.

### 2. Edge function: accept and send with CC
- `send-proposal-invitation/types.ts`: add `ccEmails?: string[]` and
  `ccNames?: string[]` to `InvitationRequest`.
- `validation.ts`: validate `ccEmails` as an optional array of email strings
  (max ~10), drop invalid entries rather than failing the request.
- `email-service.ts` `sendInvitationEmail`: add the CC list to the Resend `cc`
  field alongside the existing agent CC (agent CC behaviour unchanged).
- Email copy: no change to body or buttons — the primary client remains the
  addressee ("Dear {primaryName}") and the signer.

### 3. Logging and status
- Log the CC list in `proposal_automation_log.details.cc` for audit.
- Bounce handling: the resend-webhook already classifies CC-only bounces as
  non-blocking (primary-recipient matching), so a bouncing CC must not mark the
  proposal bounced — verify this path with the existing classification rules.
- Proposal status transitions (draft → sent etc.) are unchanged.

### 4. Verification
- `bunx tsgo --noEmit` and `bun run build` pass.
- Local render harness (stubbed Resend) to confirm the `cc` array reaches the
  Resend call with agent + additional clients.
- Playwright/desktop check that send/resend still succeeds on a proposal with
  no additional clients (regression) and review edge-function logs for a send
  with additional clients.

## Technical details
- Files touched:
  - `src/components/proposals/hooks/useProposalInvitations.ts`
  - `supabase/functions/send-proposal-invitation/types.ts`
  - `supabase/functions/send-proposal-invitation/validation.ts`
  - `supabase/functions/send-proposal-invitation/email-service.ts`
  - `supabase/functions/send-proposal-invitation/index.ts` (pass-through + logging)
- Edge function deploys automatically after edit.
- No database migration required — additional clients already persist in
  `proposals.content`.
