import { supabase } from "@/integrations/supabase/client";
import { dynamicCarbonPricingService } from "@/lib/calculations/carbon/dynamicPricing";
import { calculateCarbonCredits } from "@/services/calculations/carbon/calculations";
import {
  calculateRevenueByYearSync,
  getAgentCommissionPercentage,
  getClientSharePercentage,
} from "@/services/calculations/carbon/pricing";

/**
 * CSV export for the Project Onboarding section.
 *
 * Takes the project_onboarding IDs currently visible (already filtered by role,
 * search and status on the list page), pulls every field we hold for those
 * projects, and produces a single CSV row per project.
 *
 * Credential secrets (api_key_encrypted) are never exported.
 */

const REQUIRED_DOC_CATEGORIES = ["coc", "invoice"] as const;

const DOC_CATEGORY_LABELS: Record<string, string> = {
  coc: "CoC",
  invoice: "Invoice",
  calibration_cert: "Calibration Certificate",
  om_agreement: "O&M Agreement",
  meter_cert: "Meter Certificate",
  other: "Other",
};

type AnyRecord = Record<string, any>;

/** Format a date/timestamp as ISO 8601 (YYYY-MM-DD) — blank when absent. */
function isoDate(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function yesNo(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (["yes", "true", "y", "1"].includes(v)) return "Yes";
    if (["no", "false", "n", "0"].includes(v)) return "No";
    return value;
  }
  return value ? "Yes" : "No";
}

function num(value: number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

/** Render a scalar, or flatten the JSON arrays some equipment columns hold. */
function text(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) {
    return value
      .map((item) =>
        item && typeof item === "object"
          ? Object.entries(item as AnyRecord)
              .filter(([, v]) => v !== null && v !== undefined && v !== "")
              .map(([k, v]) => `${k}: ${v}`)
              .join(", ")
          : String(item)
      )
      .filter(Boolean)
      .join(" | ");
  }
  if (typeof value === "object") return text([value]);
  return String(value);
}


function csvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Human-readable summary of the per-phase array details stored as JSON. */
function summarisePhases(phasesJson: unknown): string {
  if (!phasesJson) return "";
  try {
    const parsed = typeof phasesJson === "string" ? JSON.parse(phasesJson) : phasesJson;
    if (!Array.isArray(parsed) || parsed.length === 0) return "";
    return parsed
      .map((p: AnyRecord, i: number) => {
        const parts = [
          p.panel_brand,
          p.panel_size_wp ? `${p.panel_size_wp}Wp` : null,
          p.panel_quantity ? `x${p.panel_quantity}` : null,
        ].filter(Boolean);
        return `Phase ${i + 1}: ${parts.join(" ") || "n/a"}`;
      })
      .join(" | ");
  } catch {
    return "";
  }
}

/** Same status wording the list page shows in its Status column. */
function overallStatus(row: AnyRecord): string {
  if (row.audit_ready) return "Audit Ready";
  if (row.submitted_for_review && !row.admin_validated) return "Awaiting Review";
  if (row.admin_validated) return "Under Review";
  if (row.onboarding_complete || row.data_access_verified) return "In Progress";
  return "Not Started";
}

const COLUMNS: Array<{ header: string; value: (r: AnyRecord, ctx: ExportContext) => string }> = [
  // --- Project / identity ---
  { header: "Project Name", value: (r) => text(r.proposals?.title) },
  { header: "Client Name", value: (r) => clientField(r, "name") },
  { header: "Client Email", value: (r) => clientField(r, "email") },
  { header: "Client Company", value: (r) => clientField(r, "company") },
  { header: "Site Address", value: (r) => text(f(r)?.system_address ?? r.proposals?.content?.clientInfo?.address) },
  { header: "Partner / Agent Name", value: (r, ctx) => ctx.userName(r.proposals?.agent_id) },
  { header: "Partner / Agent Email", value: (r, ctx) => ctx.userEmail(r.proposals?.agent_id) },
  { header: "Proposal Status", value: (r) => text(r.proposals?.status) },
  { header: "Signed Date", value: (r) => isoDate(r.proposals?.signed_at) },
  { header: "Created Date", value: (r) => isoDate(r.created_at) },
  { header: "Last Updated", value: (r) => isoDate(r.updated_at) },
  { header: "Last Activity At", value: (r) => isoDate(r.last_activity_at) },
  { header: "Version", value: (r) => num(r.version) },

  // --- Progress & workflow flags ---
  { header: "Overall Status", value: (r) => overallStatus(r) },
  { header: "Onboarding Complete", value: (r) => yesNo(r.onboarding_complete) },
  { header: "Onboarding Completed At", value: (r) => isoDate(r.onboarding_completed_at) },
  { header: "Data Access Verified", value: (r) => yesNo(r.data_access_verified) },
  { header: "Data Access Verified At", value: (r) => isoDate(r.data_access_verified_at) },
  { header: "Audit Ready", value: (r) => yesNo(r.audit_ready) },
  { header: "Audit Ready Marked At", value: (r) => isoDate(r.audit_ready_marked_at) },
  { header: "Audit Ready Marked By", value: (r, ctx) => ctx.userName(r.audit_ready_marked_by) },
  { header: "Submitted For Review", value: (r) => yesNo(r.submitted_for_review) },
  { header: "Submitted For Review At", value: (r) => isoDate(r.submitted_for_review_at) },
  { header: "Submitted By", value: (r, ctx) => ctx.userName(r.submitted_by) },
  { header: "Admin Validated", value: (r) => yesNo(r.admin_validated) },
  { header: "Admin Validated At", value: (r) => isoDate(r.admin_validated_at) },
  { header: "Admin Validated By", value: (r, ctx) => ctx.userName(r.admin_validated_by) },
  { header: "Assigned EPC", value: (r, ctx) => ctx.userName(r.assigned_epc_id) },
  { header: "Last Modified By", value: (r, ctx) => ctx.userName(r.last_modified_by) },

  // --- System details ---
  { header: "System Name", value: (r) => field(r, "system_name") },
  { header: "GPS Latitude", value: (r) => field(r, "system_gps_lat") },
  { header: "GPS Longitude", value: (r) => field(r, "system_gps_lng") },
  { header: "Commissioning Date", value: (r) => isoDate(f(r)?.commissioning_date) },
  { header: "Ownership Type", value: (r) => field(r, "ownership_type") },
  { header: "Connection Type", value: (r) => field(r, "connection_type") },
  { header: "Alternative Power Source", value: (r) => field(r, "alternative_power_source") },
  { header: "Inverter Brand", value: (r) => field(r, "inverter_brand") },
  { header: "Inverter Model", value: (r) => field(r, "inverter_model") },
  { header: "Inverter Capacity (kW)", value: (r) => field(r, "inverter_capacity_kw") },
  { header: "Inverter Quantity", value: (r) => field(r, "inverter_quantity") },
  { header: "Inverter Serial", value: (r) => field(r, "inverter_serial") },
  { header: "Inverter Cost", value: (r) => field(r, "inverter_cost") },
  { header: "Panel Brand", value: (r) => field(r, "panel_brand") },
  { header: "Panel Size (Wp)", value: (r) => field(r, "panel_size_wp") },
  { header: "Panel Quantity", value: (r) => field(r, "panel_quantity") },
  { header: "Panel Total (kWp)", value: (r) => field(r, "panel_total_kwp") },
  { header: "Panel Cost", value: (r) => field(r, "panel_cost") },
  { header: "Has Battery", value: (r) => yesNo(f(r)?.has_battery) },
  { header: "Battery Brand", value: (r) => field(r, "battery_brand") },
  { header: "Battery Model", value: (r) => field(r, "battery_model") },
  { header: "Battery Capacity (kWh)", value: (r) => field(r, "battery_capacity_kwh") },
  { header: "Battery Serial", value: (r) => field(r, "battery_serial") },
  { header: "Battery Cost", value: (r) => field(r, "battery_cost") },
  { header: "Data Collector Present", value: (r) => yesNo(f(r)?.data_collector_present) },
  { header: "Data Collector Serial", value: (r) => field(r, "data_collector_serial") },
  { header: "Meter Type", value: (r) => field(r, "meter_type") },
  { header: "Meter Serial", value: (r) => field(r, "meter_serial") },
  { header: "Phases", value: (r) => summarisePhases(f(r)?.phases_json) },
  { header: "Total CAPEX", value: (r) => field(r, "total_capex") },
  { header: "Labour Cost", value: (r) => field(r, "labor_cost") },
  { header: "Has Maintenance Agreement", value: (r) => yesNo(f(r)?.has_maintenance_agreement) },
  { header: "Maintenance Term (years)", value: (r) => field(r, "maintenance_agreement_term_years") },
  { header: "Maintenance Cost (annual)", value: (r) => field(r, "maintenance_cost_annual") },
  { header: "Installer Company", value: (r) => field(r, "installer_company_name") },
  { header: "Installer Email", value: (r) => field(r, "installer_email") },
  { header: "Fields Validated At", value: (r) => isoDate(f(r)?.validated_at) },
  { header: "Fields Validated By", value: (r, ctx) => ctx.userName(f(r)?.validated_by) },

  // --- Data access configuration (no credentials) ---
  { header: "Data Provider", value: (r) => access(r, "provider") },
  { header: "Site ID", value: (r) => access(r, "site_id") },
  { header: "Portal URL", value: (r, ctx) => (ctx.isAdmin ? access(r, "portal_url") : "") },
  { header: "Credential Method", value: (r) => access(r, "credential_method") },
  { header: "Delegated Email", value: (r, ctx) => (ctx.isAdmin ? access(r, "delegated_email") : "") },
  { header: "Granted By Email", value: (r, ctx) => (ctx.isAdmin ? access(r, "granted_by_email") : "") },
  { header: "Granted By Role", value: (r) => access(r, "granted_by_role") },
  { header: "Last Test Status", value: (r) => access(r, "last_test_status") },
  { header: "Last Test At", value: (r) => isoDate(d(r)?.last_test_at) },
  { header: "Last Test Error", value: (r) => access(r, "last_test_error") },
  { header: "First Data Ingested At", value: (r) => isoDate(d(r)?.first_data_ingested_at) },

  // --- Documents ---
  { header: "Documents Uploaded", value: (r) => String(docs(r).length) },
  { header: "Documents Validated", value: (r) => String(docs(r).filter((d) => d.is_validated).length) },
  {
    header: "Document Categories Present",
    value: (r) =>
      [...new Set(docs(r).map((d) => DOC_CATEGORY_LABELS[d.category] ?? d.category))].join(", "),
  },
  {
    header: "Missing Required Categories",
    value: (r) => {
      const present = new Set(docs(r).map((d) => d.category));
      return REQUIRED_DOC_CATEGORIES.filter((c) => !present.has(c))
        .map((c) => DOC_CATEGORY_LABELS[c] ?? c)
        .join(", ");
    },
  },
];

function docs(r: AnyRecord): AnyRecord[] {
  const value = r.onboarding_documents;
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

/**
 * `onboarding_fields` and `data_access_config` are UNIQUE on project_id, so
 * PostgREST returns them as a single object rather than an array. Normalise
 * both shapes.
 */
function one(value: unknown): AnyRecord | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? (value[0] as AnyRecord | undefined) : (value as AnyRecord);
}

function f(r: AnyRecord): AnyRecord | undefined {
  return one(r.onboarding_fields);
}

function d(r: AnyRecord): AnyRecord | undefined {
  return one(r.data_access_config);
}


function field(r: AnyRecord, key: string): string {
  return text(f(r)?.[key]);
}

function access(r: AnyRecord, key: string): string {
  return text(d(r)?.[key]);
}

function clientField(r: AnyRecord, kind: "name" | "email" | "company"): string {
  const proposal = r.proposals ?? {};
  const fromTable = proposal.clients ?? proposal.profiles ?? null;
  const record = Array.isArray(fromTable) ? fromTable[0] : fromTable;
  const json = proposal.content?.clientInfo ?? {};

  if (kind === "email") return text(record?.email || json.email);
  if (kind === "company") return text(record?.company_name || json.companyName || json.company);

  const fullName = record
    ? `${record.first_name ?? ""} ${record.last_name ?? ""}`.trim()
    : "";
  return fullName || text(json.name);
}

interface ExportContext {
  isAdmin: boolean;
  userName: (id: string | null | undefined) => string;
  userEmail: (id: string | null | undefined) => string;
}

/** Fetch full onboarding data for the given project_onboarding IDs. */
async function fetchRows(projectIds: string[]): Promise<AnyRecord[]> {
  const rows: AnyRecord[] = [];

  for (const ids of chunk(projectIds, 100)) {
    const { data, error } = await supabase
      .from("project_onboarding")
      .select(
        `
        *,
        proposals!inner(
          id, title, status, signed_at, agent_id, client_id, client_reference_id, content,
          system_size_kwp, carbon_credits, client_share_percentage, agent_commission_percentage, agent_portfolio_kwp,
          profiles:client_id ( first_name, last_name, email, company_name ),
          clients:client_reference_id ( first_name, last_name, email, company_name )
        ),
        onboarding_fields ( * ),
        data_access_config ( id, provider, site_id, portal_url, credential_method, delegated_email, granted_by_email, granted_by_role, last_test_status, last_test_at, last_test_error, first_data_ingested_at ),
        onboarding_documents ( category, is_validated )
      `
      )
      .in("id", ids);

    if (error) throw error;
    rows.push(...((data as AnyRecord[]) ?? []));
  }

  return rows;
}

/** Resolve every referenced user UUID to a display name/email in one query. */
async function buildUserLookup(rows: AnyRecord[]) {
  const ids = new Set<string>();
  const add = (v: unknown) => {
    if (typeof v === "string" && v) ids.add(v);
  };

  rows.forEach((r) => {
    add(r.proposals?.agent_id);
    add(r.audit_ready_marked_by);
    add(r.submitted_by);
    add(r.admin_validated_by);
    add(r.assigned_epc_id);
    add(r.last_modified_by);
    add(f(r)?.validated_by);
  });

  const lookup = new Map<string, { name: string; email: string }>();
  if (ids.size === 0) return lookup;

  for (const batch of chunk([...ids], 200)) {
    const { data } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, email")
      .in("id", batch);

    (data ?? []).forEach((p: AnyRecord) => {
      lookup.set(p.id, {
        name: `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || text(p.email),
        email: text(p.email),
      });
    });
  }

  return lookup;
}

export function onboardingCsvHeaders(): string[] {
  return COLUMNS.map((c) => c.header);
}

// ---------------------------------------------------------------------------
// Revenue projection — same engine the Revenue tab renders from
// ---------------------------------------------------------------------------

interface RevenueBreakdown {
  credits: number;
  clientPct: number;
  agentPct: number;
  platformPct: number;
  client: Record<string, number>;
  agent: Record<string, number>;
  platform: Record<string, number>;
  total: Record<string, number>;
}

function pct(value: number): string {
  return Number(value.toFixed(2)).toString();
}

/**
 * Revenue is never stored on the project — it is derived from system size,
 * commissioning date, share percentages and the client's carbon rate set.
 * Recompute it here so the export matches the Revenue tab exactly.
 */
async function buildRevenueLookup(rows: AnyRecord[]) {
  const priceCache = new Map<string, Record<string, number>>();
  const byProject = new Map<string, RevenueBreakdown>();
  const years = new Set<string>();

  for (const r of rows) {
    const p = r.proposals ?? {};
    const clientId: string | null = p.client_reference_id ?? null;
    const cacheKey = clientId ?? "__default__";

    if (!priceCache.has(cacheKey)) {
      priceCache.set(cacheKey, await dynamicCarbonPricingService.getCarbonPricesForClient(clientId));
    }
    const prices = priceCache.get(cacheKey)!;

    const sizeKwp = Number(p.system_size_kwp) || 0;
    const credits = Number(p.carbon_credits) || calculateCarbonCredits(sizeKwp);

    const portfolioKwp = Number(p.agent_portfolio_kwp) || sizeKwp;
    const clientPct = Number(p.client_share_percentage ?? getClientSharePercentage(portfolioKwp));
    const agentPct = Number(
      p.agent_commission_percentage ?? getAgentCommissionPercentage(portfolioKwp, !!p.agent_id)
    );
    const platformPct = Number((100 - clientPct - agentPct).toFixed(2));

    const commissionDate =
      p.content?.projectInfo?.commissionDate || f(r)?.commissioning_date || undefined;

    const client = calculateRevenueByYearSync(
      credits,
      clientPct,
      prices,
      commissionDate,
      (r.audit_tags as string[] | null) ?? null
    );
    const agent: Record<string, number> = {};
    const platform: Record<string, number> = {};
    const total: Record<string, number> = {};

    Object.entries(client).forEach(([year, clientRevenue]) => {
      const gross = clientPct > 0 ? clientRevenue / (clientPct / 100) : 0;
      total[year] = Math.round(gross);
      agent[year] = Math.round(gross * (agentPct / 100));
      platform[year] = Math.round(gross * (platformPct / 100));
      years.add(year);
    });

    byProject.set(r.id, {
      credits,
      clientPct,
      agentPct,
      platformPct,
      client,
      agent,
      platform,
      total,
    });
  }

  return { byProject, years: [...years].sort() };
}

function sum(map: Record<string, number>): number {
  return Object.values(map).reduce((acc, v) => acc + v, 0);
}

function revenueColumns(
  years: string[],
  byProject: Map<string, RevenueBreakdown>,
  isAdmin: boolean
): Array<{ header: string; value: (r: AnyRecord) => string }> {
  const get = (r: AnyRecord) => byProject.get(r.id);
  const cols: Array<{ header: string; value: (r: AnyRecord) => string }> = [
    { header: "Carbon Credits (tCO2e/yr)", value: (r) => (get(r) ? get(r)!.credits.toFixed(2) : "") },
    { header: "Client Share %", value: (r) => (get(r) ? pct(get(r)!.clientPct) : "") },
    { header: "Agent Commission %", value: (r) => (get(r) ? pct(get(r)!.agentPct) : "") },
  ];

  if (isAdmin) {
    cols.push({ header: "Platform Fee %", value: (r) => (get(r) ? pct(get(r)!.platformPct) : "") });
  }

  years.forEach((year) => {
    cols.push({
      header: `Client Revenue ${year} (ZAR)`,
      value: (r) => num(get(r)?.client[year] ?? null),
    });
    cols.push({
      header: `Agent Commission ${year} (ZAR)`,
      value: (r) => num(get(r)?.agent[year] ?? null),
    });
    if (isAdmin) {
      cols.push({
        header: `Platform Fee ${year} (ZAR)`,
        value: (r) => num(get(r)?.platform[year] ?? null),
      });
    }
    cols.push({
      header: `Total Revenue ${year} (ZAR)`,
      value: (r) => num(get(r)?.total[year] ?? null),
    });
  });

  cols.push({
    header: "Total Client Revenue (ZAR)",
    value: (r) => (get(r) ? String(sum(get(r)!.client)) : ""),
  });
  cols.push({
    header: "Total Agent Commission (ZAR)",
    value: (r) => (get(r) ? String(sum(get(r)!.agent)) : ""),
  });
  if (isAdmin) {
    cols.push({
      header: "Total Platform Revenue (ZAR)",
      value: (r) => (get(r) ? String(sum(get(r)!.platform)) : ""),
    });
  }
  cols.push({
    header: "Total Revenue (ZAR)",
    value: (r) => (get(r) ? String(sum(get(r)!.total)) : ""),
  });

  return cols;
}

export interface ExportOptions {
  projectIds: string[];
  isAdmin: boolean;
}

/** Build the CSV text for the given projects. */
export async function buildOnboardingCsv({ projectIds, isAdmin }: ExportOptions): Promise<string> {
  const rows = await fetchRows(projectIds);
  const users = await buildUserLookup(rows);
  const { byProject, years } = await buildRevenueLookup(rows);
  const revenueCols = revenueColumns(years, byProject, isAdmin);

  const ctx: ExportContext = {
    isAdmin,
    userName: (id) => (id ? users.get(id)?.name ?? "" : ""),
    userEmail: (id) => (id ? users.get(id)?.email ?? "" : ""),
  };

  // Preserve the on-screen ordering of the list page
  const order = new Map(projectIds.map((id, i) => [id, i]));
  rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

  const lines = [
    [...COLUMNS.map((c) => c.header), ...revenueCols.map((c) => c.header)].map(csvCell).join(","),
    ...rows.map((r) =>
      [
        ...COLUMNS.map((c) => c.value(r, ctx)),
        ...revenueCols.map((c) => c.value(r)),
      ]
        .map(csvCell)
        .join(",")
    ),
  ];

  return lines.join("\r\n");
}

/** Trigger a browser download of the CSV (UTF-8 BOM so Excel reads it correctly). */
export function downloadCsv(csv: string, filename: string) {
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function onboardingCsvFilename(): string {
  return `project-onboarding-${new Date().toISOString().slice(0, 10)}.csv`;
}
