# Make the post-signing path to Audit Ready clear and reliable

## What the review found

- The success screen does say what comes next: system details, compliance documents, and data access, with a **Start onboarding** button.
- It does not clearly explain the full path: complete onboarding → submit for Crunch Carbon review → become Audit Ready.
- The signed-agreement email only says Crunch Carbon will “proceed with the next steps.” It has no onboarding checklist or action button.
- The success screen builds `/onboarding/{proposal ID}`, while that page expects the separate onboarding project ID. This can send the signer to “Project not found.”
- The automatic follow-up service is not a reliable fallback for this signing flow: signing saves the proposal as `approved`, while its post-signing searches use `accepted` and `cession_signed`. Its stored email placeholders also do not match the replacement names used by the sender.
- The database does create an onboarding record whenever a proposal is signed. All 262 active signed proposals currently have one, so the handoff data exists; the client-facing path is the weak point.

## Proposed experience

Immediately after signing, show a focused **Next: complete onboarding** section:

1. **Complete project details** — confirm the system, installer, and ownership information.
2. **Upload documents** — provide the required certificates, invoices, and supporting documents.
3. **Connect generation data** — configure inverter or meter access and verify the connection.
4. **Submit for review** — Crunch Carbon checks the information and resolves any outstanding items.
5. **Audit Ready** — the client is notified when the project is ready for the audit process.

Keep **Start onboarding** as the prominent action. Keep **I’ll do this later**, but explain that the signed agreement alone does not make the project Audit Ready. Move the WhatsApp referral card below this required journey so it cannot distract from onboarding.

## Implementation

- Return the created onboarding project ID from the signing service and use that ID for every onboarding destination.
- Update the signed success screen with the five-step journey, an accurate status message, and the correct onboarding link.
- For signed-out clients, retain the password-free email-link handoff; make the confirmation explicitly say the link opens this project’s onboarding.
- Add a clear **Complete onboarding** section and action to the signed-agreement email, including what is required and why it is needed for Audit Ready.
- Repair the automatic post-signing follow-up rules and template placeholders so reminders target the statuses produced by the actual signing flow and their links resolve to the onboarding project.
- Preserve authentication, company access rules, signed-document generation, and existing legal records.

## Verification

- Test new client, existing signed-in client, and returning company signer journeys.
- Confirm signing creates exactly one onboarding record and opens that record, not the proposal ID.
- Confirm the signed-agreement email contains the correct next steps and working destination.
- Confirm incomplete clients see their outstanding items, submitted clients see “with Crunch Carbon,” and completed clients receive the Audit Ready confirmation.
- Check desktop and mobile layouts, reduced-motion behavior, email rendering, and application build.
