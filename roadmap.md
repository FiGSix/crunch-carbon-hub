# Calculator reliability

- [x] Diagnose Shaun's repeated calculator failure from live logs and data
- [x] Make duplicate matching safe for legacy size and GPS formats
- [x] Harden client reuse, request validation, proposal responses, and email outcomes
- [x] Run automated checks and browser coverage
- [ ] Run one live Shaun submission after the staged database correction applies

# Rhino Energy signing and visibility

- [x] Keep portfolio visibility company-aware and isolate cached results by signed-in user
- [x] Enforce authenticated company signing permissions server-side
- [x] Store and render the validated actual signer separately from the contact
- [x] Add regression tests for company signer authorization and identity
- [x] Verify both Rhino memberships resolve all 10 projects and confirm build health
- [ ] Run signed-in browser checks as Naazia and Juan — blocked because account access approval was declined

# Signing completion and agent identity

- [x] Root cause: duplicate solo-company creation during signing broke the final status update
- [x] Make the solo-company helper idempotent
- [x] Mark "The Houghton" signed with Naazia's actual signing time
- [x] Name the real signer (not the contact) in the cession confirmation email
- [x] Set Naazia as signatory on the older Rhino agreement and regenerate its document
- [x] Stop recording a self-submitting client as the project agent; clear Juan from the 10 Rhino projects
- [ ] Assign an internal owner (agent) to the 10 unassigned Rhino projects — waiting on the user's choice

# Signer details on documents and company-wide cover

- [x] Documents show the signer's own name and email instead of the contact's
- [x] Record the signer's email on the signature and agreement records
- [x] One signature now covers every project of the same company, including drafts
- [x] New projects for a company that already signed are covered automatically at creation
- [x] Applied Naazia's signature to the 8 outstanding Rhino projects and generated each document
- [x] Regenerated The Houghton document and emailed it to Naazia
- [x] Deleted the two June test projects
- [ ] "Foreman Orical" under Naazia's own contact record is in the deleted bin — confirm whether to restore and cover it
