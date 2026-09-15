# Partners cannot list themselves as the client

A hard business rule: when a partner creates a proposal, the client cannot be the partner's own sign-in email address. A colleague at the same company is still allowed — that person is simply invited and listed as a client.

Admins are exempt (they may create proposals on anyone's behalf).

## What the user sees

- On the Client Information step, if the email entered matches the signed-in partner's own address, the field turns red with the message:
  "You cannot list yourself as the client. A partner may not act as both partner and client on the same proposal. Enter your client's email address — a colleague at your company can be added instead."
- The Next button stays disabled while that email is present.
- The same check applies to every additional client added to the proposal.
- If they somehow get past the form (saved draft, editing an existing proposal, bulk upload), submission is refused with a pop-up carrying the same message, so nothing slips through.

## Where the rule is applied

1. Create Proposal — client step, both the primary client and any additional clients.
2. Edit proposal — changing a client's email on an existing proposal.
3. Proposal submission — final server-side guard before the proposal is written.
4. Bulk upload — rows where the client email equals the uploading partner's address are rejected with a clear reason in the results list.

## Technical notes

- Comparison is case-insensitive and trimmed; compare against the signed-in user's email from the auth context / profile.
- Frontend: add a shared helper `isSelfAsClient(email, userEmail, role)` under `src/lib/validation/`. Wire it into `ClientFormFields.tsx`, `AdditionalClientForm.tsx` (inline error + disable), `ClientInfoStep.tsx` (`isFormValid`), and `ProposalEditDialog.tsx`.
- Submission guard: `ReliableProposalService.createProposalReliably` validates primary and additional client emails against the signed-in user before any client record is created, returning a specific error surfaced as a destructive toast in `ProposalSubmitFormReliable.tsx`.
- Server-side: in `supabase/functions/manage-client-profile`, reject when the requested client email equals the authenticated caller's email and the caller is not an admin (400 with the rule message). In `bulk-upload-proposals`, skip and report such rows.
- Role check: exempt `admin` only; the rule applies to `agent` and `super_partner`.
- No database schema change is needed.
