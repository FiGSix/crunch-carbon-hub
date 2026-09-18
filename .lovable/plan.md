# Temporary Audit 2 notice in proposal emails

## Goal
Add a prominent notice directly below the three proposal action buttons in every initial proposal invitation and resend sent on **18 September 2026**, then remove it automatically at midnight Johannesburg time.

## Changes
- Add a date-gated notice card beneath **Review Proposal**, **Accept & Sign**, and **Decline** in the shared proposal invitation email template.
- Show the card through **23:59:59 on 18 September 2026 in Africa/Johannesburg**; emails generated from 19 September onward will use the normal template automatically.
- Use polished wording while preserving the exact deadline, Audit 2 period, consequence, and offer of help:

  **Important Audit 2 deadline**

  Today, 18 September 2026 at 17:00, is the cut-off for projects to be Audit Ready for inclusion in Audit 2, covering the period from 1 January 2025 to 30 June 2026 on the Crunch Carbon platform. Projects that are not Audit Ready by the deadline will forfeit potential income for this period, but will still be eligible to participate in Audit 3 (timelines to be confirmed). If you are struggling with anything, please let us know — together, we can help get your project ready before closing.

- Add the same notice to the email's plain-text version so recipients who cannot view styled emails still receive it.
- Keep all existing proposal wording, recipients, links, action buttons, and sending behavior unchanged.

## Coverage
The shared template handles both first-time proposal invitations and resends. Other proposal-related emails do not contain these three buttons and will not be changed.

## Validation
- Preview the email at desktop and phone widths and confirm the notice sits directly below the buttons.
- Verify the Johannesburg date boundary: visible during 18 September and absent from 19 September onward.
- Confirm the HTML and plain-text versions contain matching notice content.
- Check the project build after implementation.

## Technical details
Use an explicit `Africa/Johannesburg` date comparison when generating the email rather than relying on the server's timezone. Keep the temporary condition localized to the shared proposal invitation email service so it expires without a later cleanup deployment.
