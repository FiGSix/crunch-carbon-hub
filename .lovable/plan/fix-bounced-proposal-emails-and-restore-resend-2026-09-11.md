# Fix bounced proposal emails and restore resend

## Confirmed problem

- A Resend bounce changes the proposal itself to `bounced`.
- The proposal page has no action for that status, and the sending logic also rejects it, leaving staff stuck.
- The webhook currently treats any bounce on the Resend message as the client's bounce. Because proposal emails copy the agent, an agent's full mailbox can incorrectly mark many unrelated client proposals as bounced.
- Recent production records confirm this happened: one copied address generated bounces across 14 proposals whose actual client addresses were different.
- Editing the client's address updates the live client record, but it does not recover the proposal status. The old bounce remains visible and the resend control stays hidden.
- The suppression check currently treats every bounce as permanent, even when Resend identifies it as a temporary `MailboxFull` bounce.

## Implementation plan

1. **Correct bounce attribution at the webhook**
   - Match the bounced recipient against the original primary recipient stored for the Resend message.
   - If only the copied agent address bounced, record that event for diagnostics but do not mark the client's proposal as bounced or block the client address.
   - Continue marking the proposal as bounced when the actual primary client recipient bounced.

2. **Classify temporary and permanent failures correctly**
   - Read Resend's bounce type and subtype from the webhook payload.
   - Treat temporary failures such as `Transient / MailboxFull` as retryable.
   - Keep permanent delivery failures and complaints blocked to protect sender reputation.
   - Preserve the complete email-event history; recovery will not erase evidence of the original failure.

3. **Add an explicit recovery action to bounced proposals**
   - Show a clear **Retry email** action when a proposal is bounced.
   - Resolve the latest saved client address before sending, so correcting the address immediately enables retry.
   - If the current address has a permanent block, keep the action visible but explain that the address must be corrected or unblocked by an admin instead of silently hiding the control.
   - On a successful retry, move the proposal back to `sent`, refresh its secure invitation link, and retain an audit entry.

4. **Synchronise edits without hiding history**
   - When proposal contact details are edited, keep the proposal snapshot and linked client email aligned.
   - Do not automatically delete a permanent block on the old address; it remains protected if reused.
   - Ensure a corrected, unsuppressed address can be retried from the same proposal.

5. **Repair affected proposal states safely**
   - Identify proposals incorrectly marked bounced because only the copied agent address failed.
   - Restore only those still in `bounced` state to the appropriate sendable state; do not alter signed, approved, declined, archived, or otherwise progressed proposals.
   - Keep their historical bounce events for traceability.

6. **Verify the complete recovery flow**
   - Test client bounce versus copied-agent bounce.
   - Test temporary mailbox-full retry, permanent blocked-address handling, and retry after changing the client email.
   - Verify agent and admin controls on desktop and mobile, confirm successful sends return the status to `sent`, and check the deployed webhook/function logs.

## Technical details

- Update the Resend webhook, proposal invitation controls, invitation hook, and proposal edit save path.
- Update the suppression database function so temporary bounces do not become permanent blocks, while complaints and permanent bounces remain protected.
- Apply a narrowly scoped data repair based on each message's recorded primary recipient rather than broad status clearing.
- Add regression coverage around recipient attribution, suppression classification, bounced-status retries, and email edits.
