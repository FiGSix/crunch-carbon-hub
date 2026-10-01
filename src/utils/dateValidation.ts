/**
 * Commissioning-date rules for NEW projects.
 *
 * Verra VCS 5.0: projects newly onboarded to the current monitoring period must
 * have been switched on / commissioned on or after 1 July 2026. Existing
 * proposals and projects already in Audit 1 / Audit 2 are not affected.
 * Server mirror: supabase/functions/_shared/commissionCutoff.ts
 */

export const NEW_PROJECT_MIN_COMMISSION_DATE = new Date(2026, 6, 1);
export const NEW_PROJECT_MIN_COMMISSION_ISO = "2026-07-01";

/** Kept for existing imports. */
export const MINIMUM_COMMISSION_DATE = NEW_PROJECT_MIN_COMMISSION_DATE;

export const VERRA_CUTOFF_TITLE = "Important eligibility update";

export const VERRA_CUTOFF_NOTICE =
  "Important eligibility update: Due to changes to Verra’s Verified Carbon Standard rules, solar projects being newly onboarded to this monitoring period must have been switched on or commissioned on or after 1 July 2026. Unfortunately, projects commissioned before this date that were not already included in an earlier Crunch Carbon audit can no longer be newly added under this monitoring period. We know this may be disappointing, but this is a Verra eligibility requirement rather than a Crunch Carbon decision. If your system was commissioned on or after 1 July 2026, you can continue with the onboarding process.";

/** True when a date falls before the new-project cutoff. */
export function isBeforeNewProjectCutoff(date: Date | string | null | undefined): boolean {
  if (!date) return false;
  const d = typeof date === "string" ? new Date(`${date.slice(0, 10)}T00:00:00`) : date;
  if (Number.isNaN(d.getTime())) return false;
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return day < NEW_PROJECT_MIN_COMMISSION_DATE;
}

export function validateCommissionDate(dateString: string): {
  isValid: boolean;
  error?: string;
  beforeCutoff?: boolean;
} {
  if (!dateString) return { isValid: false, error: "Commission date is required" };
  if (Number.isNaN(new Date(dateString).getTime())) {
    return { isValid: false, error: "Invalid date format" };
  }
  if (isBeforeNewProjectCutoff(dateString)) {
    return { isValid: false, error: VERRA_CUTOFF_NOTICE, beforeCutoff: true };
  }
  return { isValid: true };
}

export function getMinimumDateString(): string {
  return NEW_PROJECT_MIN_COMMISSION_ISO;
}
