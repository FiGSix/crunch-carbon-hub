/**
 * Audit eligibility periods (server mirror of the app's auditPeriods module).
 *
 *   - Audit 1 : 15 September 2022 onwards (completed round)
 *   - Audit 2 : 1 January 2025 onwards    (closed round)
 *   - Audit 3 : 1 July 2026 onwards       (open round)
 *
 * Projects not tagged into Audit 1 or Audit 2 — every new proposal — forfeit
 * generation before 1 July 2026.
 */

export type AuditTag = "Audit 1" | "Audit 2" | "Audit 3";

export const AUDIT_PERIOD_STARTS: Record<AuditTag, Date> = {
  "Audit 1": new Date(2022, 8, 15),
  "Audit 2": new Date(2025, 0, 1),
  "Audit 3": new Date(2026, 6, 1),
};

export const DEFAULT_ELIGIBLE_START = AUDIT_PERIOD_STARTS["Audit 3"];

export function getAuditPeriodStart(auditTags?: readonly string[] | null): Date {
  if (auditTags?.includes("Audit 1")) return AUDIT_PERIOD_STARTS["Audit 1"];
  if (auditTags?.includes("Audit 2")) return AUDIT_PERIOD_STARTS["Audit 2"];
  return DEFAULT_ELIGIBLE_START;
}

export function getEligibleStartDate(
  commissionDate?: string | Date | null,
  auditTags?: readonly string[] | null,
): Date {
  const auditStart = getAuditPeriodStart(auditTags);
  if (!commissionDate) return auditStart;
  const commissioned = commissionDate instanceof Date ? commissionDate : new Date(commissionDate);
  if (Number.isNaN(commissioned.getTime())) return auditStart;
  return commissioned > auditStart ? commissioned : auditStart;
}

const DAY_MS = 1000 * 60 * 60 * 24;

export function eligibleFractionOfYear(year: number, eligibleStart: Date): number {
  const startYear = eligibleStart.getFullYear();
  if (year < startYear) return 0;
  if (year > startYear) return 1;

  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31);
  const remainingDays = Math.max(
    0,
    Math.floor((yearEnd.getTime() - eligibleStart.getTime()) / DAY_MS) + 1,
  );
  const totalDays = Math.floor((yearEnd.getTime() - yearStart.getTime()) / DAY_MS) + 1;
  return remainingDays / totalDays;
}

export function formatEligibleStart(eligibleStart: Date): string {
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${eligibleStart.getDate()} ${months[eligibleStart.getMonth()]} ${eligibleStart.getFullYear()}`;
}

/** Audit rounds a proposal's onboarding project belongs to (empty when not onboarded). */
export async function getProposalAuditTags(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  proposalId: string,
): Promise<AuditTag[]> {
  try {
    const { data, error } = await supabase
      .from("project_onboarding")
      .select("audit_tags")
      .eq("proposal_id", proposalId)
      .maybeSingle();
    if (error) {
      console.error("Error fetching audit tags:", error);
      return [];
    }
    return ((data?.audit_tags || []) as AuditTag[]).slice().sort();
  } catch (error) {
    console.error("Failed to fetch audit tags:", error);
    return [];
  }
}
