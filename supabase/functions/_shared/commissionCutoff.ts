/**
 * Server mirror of src/utils/dateValidation.ts.
 * New projects must be commissioned on or after 1 July 2026 (Verra VCS 5.0).
 */

export const NEW_PROJECT_MIN_COMMISSION_ISO = "2026-07-01";
export const VERRA_CUTOFF_CODE = "COMMISSION_BEFORE_VERRA_CUTOFF";

export const VERRA_CUTOFF_NOTICE =
  "Important eligibility update: Due to changes to Verra’s Verified Carbon Standard rules, solar projects being newly onboarded to this monitoring period must have been switched on or commissioned on or after 1 July 2026. Unfortunately, projects commissioned before this date that were not already included in an earlier Crunch Carbon audit can no longer be newly added under this monitoring period. We know this may be disappointing, but this is a Verra eligibility requirement rather than a Crunch Carbon decision. If your system was commissioned on or after 1 July 2026, you can continue with the onboarding process.";

/** True when a YYYY-MM-DD (or ISO) date is before the cutoff. Invalid dates return false. */
export function isBeforeNewProjectCutoff(date: string | null | undefined): boolean {
  if (!date || typeof date !== "string") return false;
  const day = date.trim().replace(/\//g, "-").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  return day < NEW_PROJECT_MIN_COMMISSION_ISO;
}
