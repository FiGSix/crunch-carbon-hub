# Audits are cumulative: a project can be in several audits

## What changes for you
- A project can now belong to more than one audit (e.g. Audit 1, 2 and 3), not just one.
- On Vintage & Revenue, each project row shows every audit it is in, e.g. "Audit 1 · Audit 2 · Audit 3".
- Admins tick or untick audits per project (checkbox list instead of a single choice), for the rare project that drops out.
- New admin button on each audit card, "Carry forward from Audit N": adds every project in Audit N to Audit N+1 in one click, skipping any that are no longer Audit Ready. It shows a count and asks you to confirm first.
- Audit filter meaning: "Audit 2" = every project included in Audit 2 (no matter when it joined). "Not in an audit" = in none. We also add "New in Audit 3", meaning projects whose first audit is Audit 3.
- Audit round cards count everyone in each audit (so totals add up over time), plus a smaller "new this round" figure.
- Clients and partners see the same list of audits on their own projects.

## Rules kept
- Only admins can change audits; the server checks this.
- Only Audit Ready projects can be added. If a project loses Audit Ready, it stays in audits that are already Completed or Closed (1 and 2), because those are history. It is only removed from the open audit (3).
  - This changes the current rule, which clears all audit tags when a project loses Audit Ready.

## Technical details
- Migration: replace `project_onboarding.audit_tag text` with `audit_tags text[] not null default '{}'`. Add a check that every element is in ('Audit 1','Audit 2','Audit 3'), plus a GIN index. Any tags already set move into the array (no project is tagged today).
- Trigger: block adding tags when audit_ready is not true. When audit_ready turns false, remove only 'Audit 3'.
- RPCs (SECURITY DEFINER, has_role('admin'), EXECUTE for authenticated only):
  - `set_project_audit_tags(p_onboarding_id uuid, p_tags text[])`, which replaces `set_project_audit_tag` (dropped).
  - `carry_forward_audit(p_from text, p_to text) returns int`, which only adds Audit Ready projects.
- `useProjectAudits.ts`: `auditTags: AuditTag[]`, mutation for set and carry-forward, filter helpers (includes / first-audit).
- `ProjectsAuditTable.tsx`: multi-badge cell, admin popover with checkboxes, and the new filter option.
- `AuditOverviewCard.tsx`: cumulative and "new" counts, plus the carry-forward button (admins only).
- Check: non-admins get refused, non-ready projects get refused, carry-forward counts match a direct query, and the page renders.
