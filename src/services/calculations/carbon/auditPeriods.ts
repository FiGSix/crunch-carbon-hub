/**
 * Audit eligibility periods.
 *
 * Generation can only be claimed from the start of the audit round a project
 * belongs to:
 *   - Audit 1  : 15 September 2022 onwards (completed round)
 *   - Audit 2  : 1 January 2025 onwards    (closed round)
 *   - Audit 3  : 1 July 2026 onwards       (open round)
 *
 * A project that is not tagged into Audit 1 or Audit 2 — which includes every
 * newly created proposal — forfeits generation before 1 July 2026.
 *
 * Audits are cumulative: a project tagged into Audit 1 keeps the earliest
 * eligible start date of all its tags.
 */

export type AuditTag = "Audit 1" | "Audit 2" | "Audit 3";

/** Local-time start dates for each audit round. */
export const AUDIT_PERIOD_STARTS: Record<AuditTag, Date> = {
  "Audit 1": new Date(2022, 8, 15),
  "Audit 2": new Date(2025, 0, 1),
  "Audit 3": new Date(2026, 6, 1),
};

/** Start date used for any project not tagged into an earlier audit round. */
export const DEFAULT_ELIGIBLE_START = AUDIT_PERIOD_STARTS["Audit 3"];

/**
 * Earliest generation date a project may claim, based on its audit tags.
 * Untagged projects (and Audit 3 only) start at 1 July 2026.
 */
export function getAuditPeriodStart(
  auditTags?: readonly string[] | null,
): Date {
  if (auditTags?.includes("Audit 1")) return AUDIT_PERIOD_STARTS["Audit 1"];
  if (auditTags?.includes("Audit 2")) return AUDIT_PERIOD_STARTS["Audit 2"];
  return DEFAULT_ELIGIBLE_START;
}

/**
 * The date from which generation actually counts: the later of the
 * commissioning date and the audit period start.
 */
export function getEligibleStartDate(
  commissionDate?: string | Date | null,
  auditTags?: readonly string[] | null,
): Date {
  const auditStart = getAuditPeriodStart(auditTags);
  if (!commissionDate) return auditStart;
  const commissioned =
    commissionDate instanceof Date ? commissionDate : new Date(commissionDate);
  if (Number.isNaN(commissioned.getTime())) return auditStart;
  return commissioned > auditStart ? commissioned : auditStart;
}

const DAY_MS = 1000 * 60 * 60 * 24;

/**
 * Fraction of a calendar year that is eligible, given an eligible start date.
 * 0 for years entirely before the start, 1 for years entirely after it.
 */
export function eligibleFractionOfYear(
  year: number,
  eligibleStart: Date,
): number {
  const startYear = eligibleStart.getFullYear();
  if (year < startYear) return 0;
  if (year > startYear) return 1;

  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31);
  const remainingDays = Math.max(
    0,
    Math.floor((yearEnd.getTime() - eligibleStart.getTime()) / DAY_MS) + 1,
  );
  const totalDays =
    Math.floor((yearEnd.getTime() - yearStart.getTime()) / DAY_MS) + 1;
  return remainingDays / totalDays;
}

/** True when the year is only partly claimable (used to footnote the table). */
export function isPartialYear(year: number, eligibleStart: Date): boolean {
  const fraction = eligibleFractionOfYear(year, eligibleStart);
  return fraction > 0 && fraction < 1;
}

/** Human wording for the start of a partially claimable year, e.g. "From 1 July 2026". */
export function formatEligibleStart(eligibleStart: Date): string {
  return eligibleStart.toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
