Here is the detailed implementation plan based on your requirements and preferences:

1. Data Model & Validation Rules

Audit Tagging on project_onboarding:

Add an audit_tag column to project_onboarding (text, nullable, with allowed values: 'Audit 1', 'Audit 2', 'Audit 3', or NULL).

Audit Ready Guard: Enforce that a project can only be tagged with an audit if audit_ready = true. If a project is not audit ready, attempting to set an audit tag is rejected. If a project is subsequently marked not audit ready, its audit tag is automatically cleared.

Admin-Gated RPC: Create set_project_audit_tag(p_onboarding_id uuid, p_audit_tag text) with SECURITY DEFINER and strict has_role('admin') check.

Audit Cycles:

Audit 1: Completed.

Audit 2: Closed (covered 1 Jan 2025 to 30 Jun 2026).

Audit 3: Currently Open (accepts projects that achieve Audit Ready status).

Unassigned / Pending: Projects not yet allocated to an audit.

2. Rationalising the Vintage & Revenue Page (/vintage-revenue)

+----------------------------------------------------------------------------------+
|                             VINTAGE & REVENUE                                    |
+----------------------------------------------------------------------------------+
| [Card 1: Audit Cycles Overview]                                                  |
|  - Audit 1: Completed                                                            |
|  - Audit 2: Closed (1 Jan 2025 – 30 Jun 2026)                                    |
|  - Audit 3: Open for Enrollment (Audit Ready projects only)                      |
|  Displays summary counts: total projects and MWp enrolled in each audit.         |
+----------------------------------------------------------------------------------+
| [Card 2: Revenue Year-by-Year Breakdown] (Retained & Multi-Role)                 |
|  - Made available to Admins, Partners, and Clients.                              |
|  - Admins see full splits (Client, Partner, Super Partner, Crunch).              |
|  - Partners see their commission projections + client totals.                    |
|  - Clients see their projected annual carbon revenue.                            |
|  (Replaces and removes the redundant "Audit Ready Projects Est. Revenue" card)   |
+----------------------------------------------------------------------------------+
| [Card 3: Projects Audit & Readiness Explorer] (Searchable Project Table)         |
|  - Audit Dropdown: [All Audits | Audit 1 | Audit 2 | Audit 3 | Not in an Audit]  |
|  - Readiness Dropdown: [All Projects | Audit Ready | Not Audit Ready]            |
|  - Search bar: Filter by project name, client name, or address                   |
|  - Columns: Project Name, Client, Size (kWp), Readiness Badge, Audit Tag, Action |
|  - Admin Action: Inline dropdown selector to tag Audit 1 / 2 / 3 (disabled with   |
|    clear badge if project is not yet Audit Ready)                                |
+----------------------------------------------------------------------------------+

Remove Redundant Card:

Remove VintageRevenueBreakdown ("Audit Ready Projects Est. Revenue"), as its figures are already covered in greater depth by RevenueYearlyBreakdown.

Replace Abstract Cards:

Retire the old VintageProgressDisplayCard (arbitrary weighted %) and VintageBlendPipelineCard (7 static colored pills).

Replace them with a practical Audit Rounds Overview Card tracking Audit 1 (Completed), Audit 2 (Closed), and Audit 3 (Open) with enrolled project and capacity metrics.

Extend Revenue Year-by-Year Breakdown to All Roles:

Enable RevenueYearlyBreakdown for Partners and Clients, scoping data to their accessible portfolio:

Clients see their estimated annual revenue.

Partners see their projected commission income.

Admins see the full platform splits.

Interactive Searchable Project Table (ProjectsAuditTable):

Clean table showing every project in the user's scope.

Two top dropdowns:

Audit filter: All Audits, Audit 1, Audit 2, Audit 3, Not in an Audit.

Readiness filter: All Projects, Audit Ready, Not Audit Ready.

For Admins: An inline selector on each row allowing one-click tagging between Audit 1, Audit 2, Audit 3, or Unassigned. Only enabled when the project is marked "Audit Ready".

For Clients & Partners: Clearly shows which of their projects made it into Audit 1 or Audit 2, which are currently in Audit 3, and which need action to reach Audit Ready status.

3. Step-by-Step Build Order

Database Migration:

Add audit_tag column to project_onboarding with check constraint: audit_tag IN ('Audit 1', 'Audit 2', 'Audit 3') OR audit_tag IS NULL.

Add a trigger enforcing that audit_tag cannot be set if audit_ready is false or null.

Create the set_project_audit_tag admin RPC function.

Data & Query Layer:

Create useProjectAuditTagging hook for admin tagging mutations.

Create usePortfolioAuditProjects hook to fetch projects with proposal info, audit_ready status, and audit_tag respecting RLS.

Update useAdminRevenueYearlyTable (or generalize into usePortfolioRevenueYearlyTable) to support client and partner scoped projections.

UI Components & Page Integration:

Build AuditOverviewCard.tsx (cycle status + capacity counts).

Build ProjectsAuditTable.tsx (dropdown filters, search, badges, and inline admin tag selector).

Update src/pages/VintageInsights.tsx: remove VintageRevenueBreakdown, VintageProgressDisplayCard, and VintageBlendPipelineCard; mount the new AuditOverviewCard, the role-aware RevenueYearlyBreakdown, and ProjectsAuditTable.

Verification:

Verify non-admins cannot tag projects or access admin RPCs.

Verify non-audit-ready projects reject audit tags.

Verify clients and partners only see their own projects and appropriate revenue metrics.