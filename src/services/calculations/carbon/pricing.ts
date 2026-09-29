import { dynamicCarbonPricingService } from '@/lib/calculations/carbon/dynamicPricing';
import { AGENT_COMMISSION_LOW, AGENT_COMMISSION_HIGH } from './constants';

/**
 * Get client share percentage based on portfolio size
 */
export function getClientSharePercentage(portfolioKWp: number): number {
  if (portfolioKWp < 5000) return 60.20;  // 0-5MWp
  if (portfolioKWp < 10000) return 63;    // 5-10MWp
  if (portfolioKWp < 20000) return 66.5;  // 10-20MWp
  if (portfolioKWp < 30000) return 68.25; // 20-30MWp
  return 70; // 30+MWp
}

/**
 * Get agent commission percentage based on company portfolio size.
 * 4% under 15 MWp, 7% at 15 MWp+.
 * If no agent involved (added by Crunch Carbon), returns 0%.
 * Profile-level commission overrides are no longer consulted — the
 * controlling override is on the company.
 */
export function getAgentCommissionPercentage(
  companyKWp: number,
  hasAgent: boolean = true,
): number {
  if (!hasAgent) return 0;
  return companyKWp < 15000 ? AGENT_COMMISSION_LOW : AGENT_COMMISSION_HIGH;
}

/**
 * Calculate Crunch Carbon platform fee dynamically
 * Formula: 100% - Client Share % - Agent Commission %
 */
export function getCrunchCommissionPercentage(
  clientSharePercentage: number,
  agentCommissionPercentage: number
): number {
  return 100 - clientSharePercentage - agentCommissionPercentage;
}

/**
 * Calculate revenue by year using pre-fetched carbon prices (synchronous, optimized).
 *
 * Generation only counts from the eligible start date: the later of the
 * commissioning date and the start of the project's audit round. Projects with
 * no Audit 1 / Audit 2 tag (every new proposal) start on 1 July 2026.
 */
export function calculateRevenueByYearSync(
  carbonCreditsPerYear: number,
  clientSharePercentage: number,
  carbonPrices: Record<string, number>,
  commissionDate?: string | Date,
  auditTags?: readonly string[] | null
): Record<string, number> {
  const revenue: Record<string, number> = {};
  const eligibleStart = getEligibleStartDate(commissionDate, auditTags);

  Object.entries(carbonPrices).forEach(([year, price]) => {
    const yearNum = parseInt(year);
    const fraction = eligibleFractionOfYear(yearNum, eligibleStart);
    if (fraction <= 0) return;

    const yearCredits = carbonCreditsPerYear * fraction;
    revenue[year] = Math.round(yearCredits * price * (clientSharePercentage / 100));
  });

  return revenue;
}

/**
 * Calculate revenue by year using dynamic pricing (async version for backward compatibility)
 */
export async function calculateRevenueByYear(
  carbonCreditsPerYear: number,
  clientSharePercentage: number,
  commissionDate?: string | Date,
  auditTags?: readonly string[] | null
): Promise<Record<string, number>> {
  const carbonPrices = await dynamicCarbonPricingService.getCarbonPrices();
  return calculateRevenueByYearSync(
    carbonCreditsPerYear,
    clientSharePercentage,
    carbonPrices,
    commissionDate,
    auditTags
  );
}

/**
 * kWh-mode: revenue per year derived directly from user-supplied annual kWh.
 * (no yield factor, no commission pro-rating — values are taken as entered).
 * Years outside the project's audit eligibility window are still excluded, and
 * the opening part-year is scaled to the eligible portion.
 */
export function calculateRevenueByYearFromKwhSync(
  annualKwhByYear: Record<string, number>,
  emissionFactor: number,
  clientSharePercentage: number,
  carbonPrices: Record<string, number>,
  auditTags?: readonly string[] | null
): { revenueByYear: Record<string, number>; creditsByYear: Record<string, number> } {
  const revenueByYear: Record<string, number> = {};
  const creditsByYear: Record<string, number> = {};
  const eligibleStart = getAuditPeriodStart(auditTags);

  Object.entries(carbonPrices).forEach(([year, price]) => {
    const kwh = Number(annualKwhByYear[year]) || 0;
    if (kwh <= 0) return;
    const fraction = eligibleFractionOfYear(parseInt(year), eligibleStart);
    if (fraction <= 0) return;
    const credits = ((kwh * fraction) / 1000) * emissionFactor;
    creditsByYear[year] = credits;
    revenueByYear[year] = Math.round(credits * price * (clientSharePercentage / 100));
  });
  return { revenueByYear, creditsByYear };
}
