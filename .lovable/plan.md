# Fix Naazia's signature on Rhino Energy documents

## What the records actually show

- Naazia signed "Rhino Energy (Pty) Ltd – The Houghton" on 14 September at 09:16. Her name is correctly stored on both the signature record and the agreement record, and the document generator does print the stored signer name.
- Despite that, the project itself is still marked as a draft with no signed date, and it was last changed at 09:38 — after the signature. So the signing run did not finish, or the project was put back to draft afterwards. Cause not yet confirmed.
- The other Rhino projects that should have inherited the same signature were not updated either.
- The confirmation email names the person on the client contact record (Juan) rather than the person who signed. The email code builds its name from the contact record only and never reads the stored signer.
- The three June Rhino agreements hold no signatory name at all; two of them have no agreement document record.

## Plan

1. **Find out why The Houghton did not stay signed**
   - Trace the signing run for that project end to end and identify whether the status update failed, a database rule rejected it, or a later action reset it.
   - Confirm the cause from evidence before changing anything.

2. **Fix the cause, then repair The Houghton**
   - Apply the fix so a completed signature always leaves the project marked signed.
   - Mark The Houghton signed, dated to Naazia's actual signing time, and let the related Rhino projects inherit that signature as designed.

3. **Name the real signer in the email**
   - Change the signed-agreement confirmation email so it names and greets the person who actually signed, taken from the stored signature, with the company as the contracting party.
   - Keep the contact record untouched: Juan stays the project contact, and the email still goes to the usual recipients.

4. **Correct the older Rhino documents**
   - Set Naazia as the signatory on the three June Rhino agreements and regenerate those documents so they name her.
   - Create the missing agreement records for the two June projects that have none, then generate their documents.
   - Record each correction so the history shows what was changed and when.

5. **Verify**
   - Confirm The Houghton shows as signed with Naazia named on screen, in the document and in the email.
   - Confirm the other Rhino projects show the inherited signature with her name.
   - Confirm Juan still cannot sign and remains the contact.

## Technical notes

- Suspects for step 1: the proposal status update in `accept-proposal` (step 6), the `propagate_master_agreement()` trigger, and any later write that reset `status`/`signed_at`. Edge logs for `accept-proposal` are currently empty, so reproduce with a controlled call plus row-level inspection.
- Step 3 touches `supabase/functions/send-cession-agreement-email/index.ts:49-52`, replacing the contact-derived `clientName` for the signatory line with `proposal_agreements.metadata.signatory_name` / `typed_name` (falling back to the master signature), while keeping recipient resolution unchanged.
- Step 4 backfills `typed_name` and `metadata.signatory_name` on the June `proposal_agreements` rows and re-runs `generate-signed-agreement-pdf`; no legal wording is re-typeset.

## Why Juan shows as both agent and client

Confirmed from the records: all ten Rhino projects were created through the client's own project submission, which stores whoever submits as the project's agent. Juan submitted them, so his account is saved as both the agent and the client contact. His account only holds the client role, so this is bad data on the projects, not a role problem.

6. **Separate the submitter from the agent**
   - Stop saving the submitting client as the project's agent when a client submits their own project; record the submitter separately and leave the agent to be the responsible Crunch Carbon partner or admin.
   - Correct the ten Rhino projects so Juan is no longer listed as the agent.
   - I need one decision from you: who should be shown as the agent on those ten Rhino projects — an internal Crunch Carbon owner, a specific partner, or no agent until one is assigned?

Technical note: `src/services/proposals/clientProjectSubmission.ts:140` sets `agent_id: userId` from the signed-in client, which is the source of the duplication.
