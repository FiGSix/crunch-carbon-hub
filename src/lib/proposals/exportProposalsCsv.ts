import { supabase } from "@/integrations/supabase/client";
import type { ProposalListItem } from "@/types/proposals";

/**
 * CSV export for the Proposals section (admin only).
 *
 * Takes the proposals currently visible in the list — already filtered by
 * role, search, status and advanced filters — and produces one CSV row per
 * proposal. No extra filtering happens here; what you see is what you export.
 */

/** Format a date/timestamp as ISO 8601 (YYYY-MM-DD) — blank when absent. */
function isoDate(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function num(value: number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

function pct(value: number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return `${value}%`;
}

function yesNo(value: boolean | null | undefined): string {
  if (value === null || value === undefined) return "";
  return value ? "Yes" : "No";
}

function text(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

function csvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

interface AgentInfo {
  name: string;
  email: string;
}

/** Look up agent names/emails for the proposals' agent_ids in one query. */
async function buildAgentLookup(proposals: ProposalListItem[]): Promise<Map<string, AgentInfo>> {
  const ids = [...new Set(proposals.map((p) => p.agent_id).filter(Boolean))] as string[];
  const lookup = new Map<string, AgentInfo>();
  if (ids.length === 0) return lookup;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, email")
    .in("id", ids);

  if (error) {
    console.error("CSV export: failed to load agent details", error);
    return lookup;
  }

  for (const row of data ?? []) {
    const name = [row.first_name, row.last_name].filter(Boolean).join(" ").trim();
    lookup.set(row.id, { name, email: row.email ?? "" });
  }
  return lookup;
}

const COLUMNS: Array<{
  header: string;
  value: (p: ProposalListItem, agent: AgentInfo | undefined) => string;
}> = [
  // --- Project / identity ---
  { header: "Project Name", value: (p) => text(p.title || p.name) },
  { header: "Proposal ID", value: (p) => text(p.id) },
  // --- Client ---
  { header: "Client Name", value: (p) => text(p.content?.clientInfo?.name ?? p.client_name ?? p.client) },
  { header: "Client Email", value: (p) => text(p.content?.clientInfo?.email ?? p.client_email) },
  { header: "Client Company", value: (p) => text(p.content?.clientInfo?.companyName) },
  { header: "Company Registration", value: (p) => text(p.content?.clientInfo?.registrationNumber) },
  // --- Agent ---
  { header: "Agent Name", value: (p, agent) => agent?.name ?? text(p.agent ?? p.agent_name) },
  { header: "Agent Email", value: (_p, agent) => agent?.email ?? "" },
  // --- System ---
  { header: "System Size (kWp)", value: (p) => num(p.system_size_kwp ?? p.size) },
  { header: "Annual Energy (kWh)", value: (p) => num(p.annual_energy) },
  { header: "Carbon Credits (t CO2)", value: (p) => num(p.carbon_credits) },
  { header: "Multi-Phase", value: (p) => yesNo(p.isMultiPhase) },
  // --- Commercials ---
  { header: "Client Share", value: (p) => pct(p.client_share_percentage) },
  { header: "Agent Commission", value: (p) => pct(p.agent_commission_percentage) },
  // --- Status & dates ---
  { header: "Status", value: (p) => text(p.status) },
  { header: "Created Date", value: (p) => isoDate(p.created_at ?? p.date) },
  { header: "Invitation Sent", value: (p) => isoDate(p.invitation_sent_at) },
  { header: "Invitation Viewed", value: (p) => isoDate(p.invitation_viewed_at) },
  { header: "Signed Date", value: (p) => isoDate(p.signed_at) },
  { header: "Archived Date", value: (p) => isoDate(p.archived_at) },
  // --- Engagement ---
  { header: "Last Email Event", value: (p) => text(p.last_email_event_type) },
  { header: "Engagement Count", value: (p) => num(p.engagement_count) },
  { header: "Last Engagement", value: (p) => isoDate(p.last_engagement_at) },
  // --- Onboarding flags ---
  { header: "Signed", value: (p) => yesNo(!!p.signed_at) },
  { header: "Submitted For Review", value: (p) => yesNo(p.submitted_for_review) },
  { header: "Admin Validated", value: (p) => yesNo(p.admin_validated) },
  { header: "Audit Ready", value: (p) => yesNo(p.audit_ready) },
];

/** Build the CSV text for the given proposals (order preserved). */
export async function buildProposalsCsv(proposals: ProposalListItem[]): Promise<string> {
  const agents = await buildAgentLookup(proposals);

  const lines = [
    COLUMNS.map((c) => csvCell(c.header)).join(","),
    ...proposals.map((p) =>
      COLUMNS.map((c) => csvCell(c.value(p, p.agent_id ? agents.get(p.agent_id) : undefined))).join(",")
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

export function proposalsCsvFilename(): string {
  return `proposals-export-${new Date().toISOString().slice(0, 10)}.csv`;
}
