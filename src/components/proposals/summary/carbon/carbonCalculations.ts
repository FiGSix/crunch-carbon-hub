import { UnifiedCarbonService } from '@/services/calculations/carbon';
import {
  getEligibleStartDate,
  eligibleFractionOfYear,
} from '@/services/calculations/carbon/auditPeriods';

const EMISSION_FACTOR = 1.0334; // tCO₂e per MWh

/**
 * Energy claimable in a calendar year.
 * Counts only from the eligible start date: the later of the commissioning
 * date and the start of the project's audit round (1 July 2026 when the
 * project is not tagged into Audit 1 or Audit 2).
 */
export function calculateYearlyEnergy(
  systemSizeKWp: number,
  year: number,
  commissionDate?: string,
  yieldFactor?: number,
  auditTags?: readonly string[] | null
): number {
  const annualEnergy = UnifiedCarbonService.calculateAnnualEnergy(systemSizeKWp, yieldFactor);
  const eligibleStart = getEligibleStartDate(commissionDate, auditTags);
  return annualEnergy * eligibleFractionOfYear(year, eligibleStart);
}

export function calculateYearlyCarbonCredits(
  systemSizeKWp: number,
  year: number,
  commissionDate?: string,
  yieldFactor?: number,
  auditTags?: readonly string[] | null
): number {
  const yearlyEnergy = calculateYearlyEnergy(systemSizeKWp, year, commissionDate, yieldFactor, auditTags);
  return (yearlyEnergy / 1000) * EMISSION_FACTOR;
}

export function calculateTotalMWhGenerated(
  systemSizeKWp: number,
  revenue: Record<string, number>,
  commissionDate?: string,
  auditTags?: readonly string[] | null
): number {
  return Object.keys(revenue).reduce((total, year) => {
    return (
      total +
      calculateYearlyEnergy(systemSizeKWp, parseInt(year), commissionDate, undefined, auditTags) / 1000
    );
  }, 0);
}

export function calculateTotalCarbonCredits(
  systemSizeKWp: number,
  revenue: Record<string, number>,
  commissionDate?: string,
  auditTags?: readonly string[] | null
): number {
  return Object.keys(revenue).reduce((total, year) => {
    return (
      total +
      calculateYearlyCarbonCredits(systemSizeKWp, parseInt(year), commissionDate, undefined, auditTags)
    );
  }, 0);
}

/**
 * Aggregate yearly MWh across all phases for multi-phase projects
 */
export function aggregateYearlyMWhFromPhases(
  phases: Array<{ sizeKWp: number; commissionDate: string }>,
  years: string[],
  auditTags?: readonly string[] | null
): Record<string, number> {
  const aggregated: Record<string, number> = {};

  years.forEach((year) => {
    aggregated[year] = phases.reduce((sum, phase) => {
      const yearlyEnergy = calculateYearlyEnergy(
        phase.sizeKWp,
        parseInt(year),
        phase.commissionDate,
        undefined,
        auditTags
      );
      return sum + yearlyEnergy / 1000;
    }, 0);
  });

  return aggregated;
}

/**
 * Aggregate yearly tCO₂e across all phases for multi-phase projects
 */
export function aggregateYearlyCarbonCreditsFromPhases(
  phases: Array<{ sizeKWp: number; commissionDate: string }>,
  years: string[],
  auditTags?: readonly string[] | null
): Record<string, number> {
  const aggregated: Record<string, number> = {};

  years.forEach((year) => {
    aggregated[year] = phases.reduce((sum, phase) => {
      const yearlyCredits = calculateYearlyCarbonCredits(
        phase.sizeKWp,
        parseInt(year),
        phase.commissionDate,
        undefined,
        auditTags
      );
      return sum + yearlyCredits;
    }, 0);
  });

  return aggregated;
}
