# Peter du Plessis says he signed — nothing recorded

## What the records actually show

- Peter du Plessis (peterdp@moolmangroup.co.za) has 9 projects. Eight carry an empty agreement record created on 22 November 2025 — no signature, no document. The ninth, Princess Mkabayi Mall, has no agreement at all and is the one carrying his re-sign link, valid until 20 November.
- There is no signature on record for him anywhere: no cession signature, and no agreement or signature of any kind was created on the platform for him in the last day. Signatures were captured today for six other clients, so the signing path itself is working.
- Only Princess Mkabayi Mall is flagged for re-signing. His other eight projects are not flagged and hold no signing link, so any older link of his would be refused as "already signed".
- His proposal emails historically went to a colleague's address (hilton@moolmangroup.co.za), while the apology re-sign email went to peterdp@... . Recovery emails are sent directly and are not recorded alongside the other email tracking, so there is no record proving the apology email reached him — and no record of his link being opened.

So the diagnosis is not yet confirmed. Either he never got or never used the new link, or his signing attempt failed and left no trace. We cannot tell them apart today because neither the recovery email nor failed signing attempts are recorded.

## Plan

**1. Confirm what happened to Peter (first)**
- Check the send record for his apology email directly with the email provider, using the send time (21 September, 12:15), and confirm whether it was delivered, bounced or never accepted.
- Open his live signing link exactly as he would and go through it end to end on a test basis, so any failure is reproduced rather than guessed at.
- Report back one of: email never arrived / link works and he simply has not completed it / signing fails, with the exact failure.

**2. Close the blind spots that made this unanswerable**
- Record every recovery email alongside all other client email, so sent, delivered, opened and bounced are visible on the recovery page per client.
- Record when a recovery signing link is opened, and record failed signing attempts with their reason, so "he says he signed" can always be checked against the record.

**3. Make one link cover the client, not one project**
- Flag every one of a client's outstanding projects for re-signing when a link is issued, not only the nominated one, so any link the client happens to click works instead of being refused as already signed.

**4. Re-contact Peter**
- Once step 1 says why it failed, resend to the right address — his own and the colleague address that has historically received his proposals — and confirm delivery on the page.

## Technical notes

- Client `babc1350-6e6e-4bc6-8082-7f2140b9fe2f`; nominated proposal `b532a7cd` (`resign_required` true, token valid to 2026-11-20); eight sibling agreements created 2025-11-22 with `signature_image_url`, `client_cession_signature_id` and `pdf_path` all null; `client_cession_signatures` has no row for this client.
- `agreement-recovery-action` sends via Resend without persisting the message id — add an `email_events`-compatible row (or store `resend_message_id` on `agreement_recovery_events`) and let the existing Resend webhook match delivery/bounce back to the item.
- Record opens by having the acceptance page report the view for token access (`get_proposal_by_token_direct` does not stamp `invitation_viewed_at`), and log `accept-proposal` rejections into `agreement_recovery_events`.
- In `issue_link`, set `resign_required` on all of the client's affected proposals, not just the nominated one; `accept-proposal` already clears the flag after a successful signature and `propagate_master_agreement()` covers the siblings.
- Edge function logs are unavailable for this period, which is why the reproduction in step 1 is needed before any code change.
