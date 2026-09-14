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
- [ ] Two June test projects ("rhino test test test", "test test tets") have no agreement records — confirm whether to archive or generate documents
