import { UserRole } from '@/contexts/auth/types';
import { SystemSpecs, CarbonCalculationResult, PhaseRevenue } from './types';
import { DEFAULT_CARBON_FACTOR, DEFAULT_ANNUAL_GENERATION_FACTOR } from './constants';
import { normalizeToKWp, validateSystemSize } from './validation';
import { calculateAnnualEnergy, calculateCarbonCredits } from './calculations';
import {
  getClientSharePercentage,
  getAgentCommissionPercentage,
  getCrunchCommissionPercentage,
  calculateRevenueByYear,
  calculateRevenueByYearSync,
  calculateRevenueByYearFromKwhSync,
} from './pricing';
import { dynamicCarbonPricingService } from '@/lib/calculations/carbon/dynamicPricing';
import { getYieldForProvince } from './regionalYields';

/** Sum of values in a year->number map. */
function sumByYear(...maps: Array<Record<string, number> | undefined>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of maps) {
    if (!m) continue;
    for (const [y, v] of Object.entries(m)) {
      out[y] = (out[y] || 0) + (Number(v) || 0);
    }
  }
  return out;
}

/** Average across non-zero entries (used to derive a representative annual figure). */
function averageNonZero(values: number[]): number {
  const nz = values.filter((v) => v > 0);
  if (nz.length === 0) return 0;
  return nz.reduce((s, v) => s + v, 0) / nz.length;
}

function hasAnnualKwh(specs: SystemSpecs): boolean {
  if (specs.annualKwhByYear && Object.values(specs.annualKwhByYear).some((v) => (v || 0) > 0)) return true;
  if (specs.phases && specs.phases.some((p) => p.annualKwhByYear && Object.values(p.annualKwhByYear).some((v) => (v || 0) > 0))) return true;
  return false;
}

/**
 * Main calculation method - comprehensive carbon credits and revenue calculation
 */
export async function calculateComplete(
  specs: SystemSpecs,
  portfolioKWp?: number,
  userRole?: UserRole
): Promise<CarbonCalculationResult> {
  // kWh-mode: user-supplied per-year generation overrides the yield-factor path.
  if (hasAnnualKwh(specs)) {
    return calculateFromAnnualKwh(specs, portfolioKWp);
  }

  // Check if this is a multi-phase project
  if (specs.phases && specs.phases.length > 0) {
    return calculateMultiPhaseComplete(specs, portfolioKWp, userRole);
  }

  // Single-phase calculation (legacy)
  const systemSizeKwp = normalizeToKWp(specs.sizeKwp, specs.unitStandard);
  const validation = validateSystemSize(systemSizeKwp);
  
  if (!validation.isValid) {
    throw new Error(validation.error);
  }

  // Get regional yield factor
  const yieldFactor = await getYieldForProvince(specs.province);

  const annualEnergyKwh = calculateAnnualEnergy(systemSizeKwp, yieldFactor);
  const carbonCreditsPerYear = calculateCarbonCredits(systemSizeKwp, yieldFactor);

  const effectivePortfolioKWp = portfolioKWp || systemSizeKwp;
  const clientSharePercentage = specs.clientShareOverride ?? getClientSharePercentage(effectivePortfolioKWp);
  const agentCommissionPercentage = getAgentCommissionPercentage(effectivePortfolioKWp);

  const revenueByYear = await calculateRevenueByYear(
    carbonCreditsPerYear,
    clientSharePercentage,
    specs.commissionDate,
    specs.auditTags
  );

  const currentYear = new Date().getFullYear().toString();
  const currentYearRevenue = revenueByYear[currentYear] || 0;
  
  const totalRevenuePerYear = Math.round(carbonCreditsPerYear * 25);
  const clientRevenuePerYear = currentYearRevenue;
  const agentCommissionPerYear = Math.round(totalRevenuePerYear * (agentCommissionPercentage / 100));
  
  const crunchCommissionPercentage = getCrunchCommissionPercentage(clientSharePercentage, agentCommissionPercentage);
  const crunchCommissionPerYear = Math.round(totalRevenuePerYear * (crunchCommissionPercentage / 100));

  return {
    annualEnergyKwh,
    carbonCreditsPerYear,
    clientSharePercentage,
    agentCommissionPercentage,
    totalRevenuePerYear,
    clientRevenuePerYear,
    agentCommissionPerYear,
    crunchCommissionPerYear,
    systemSizeKwp,
    revenueByYear,
    isMultiPhase: false
  };
}

/**
 * Multi-phase calculation method
 */
async function calculateMultiPhaseComplete(
  specs: SystemSpecs,
  portfolioKWp?: number,
  userRole?: UserRole
): Promise<CarbonCalculationResult> {
  const phases = specs.phases!;
  
  // Calculate total system size
  const totalSystemSizeKwp = phases.reduce((sum, p) => sum + p.sizeKWp, 0);
  const validation = validateSystemSize(totalSystemSizeKwp);
  
  if (!validation.isValid) {
    throw new Error(validation.error);
  }

  // OPTIMIZATION: Memoize portfolio-based percentages (Phase 3)
  const effectivePortfolioKWp = portfolioKWp || totalSystemSizeKwp;
  const clientSharePercentage = specs.clientShareOverride ?? getClientSharePercentage(effectivePortfolioKWp);
  const agentCommissionPercentage = getAgentCommissionPercentage(effectivePortfolioKWp);
  const crunchCommissionPercentage = getCrunchCommissionPercentage(clientSharePercentage, agentCommissionPercentage);

  // OPTIMIZATION: Pre-fetch carbon prices once (Phase 1)
  const carbonPrices = await dynamicCarbonPricingService.getCarbonPrices();
  
  // Get regional yield factor
  const yieldFactor = await getYieldForProvince(specs.province);

  // OPTIMIZATION: Batch phase calculations using synchronous method (Phase 2)
  const phaseRevenues: PhaseRevenue[] = [];
  const aggregatedRevenueByYear: Record<string, number> = {};

  // Calculate each phase with pre-fetched prices
  phases.forEach((phase) => {
    const phaseAnnualEnergy = calculateAnnualEnergy(phase.sizeKWp, yieldFactor);
    const phaseCarbonCredits = calculateCarbonCredits(phase.sizeKWp, yieldFactor);
    
    // Use synchronous calculation with pre-fetched prices
    const phaseRevenueByYear = calculateRevenueByYearSync(
      phaseCarbonCredits,
      clientSharePercentage,
      carbonPrices,
      phase.commissionDate,
      specs.auditTags
    );

    // Aggregate revenue by year as we go
    Object.entries(phaseRevenueByYear).forEach(([year, revenue]) => {
      aggregatedRevenueByYear[year] = (aggregatedRevenueByYear[year] || 0) + revenue;
    });

    phaseRevenues.push({
      phaseNumber: phase.phaseNumber,
      phaseName: phase.phaseName,
      sizeKWp: phase.sizeKWp,
      commissionDate: phase.commissionDate,
      annualEnergyKwh: phaseAnnualEnergy,
      carbonCreditsPerYear: phaseCarbonCredits,
      revenueByYear: phaseRevenueByYear
    });
  });

  // Calculate totals
  const totalAnnualEnergy = phaseRevenues.reduce((sum, p) => sum + p.annualEnergyKwh, 0);
  const totalCarbonCredits = phaseRevenues.reduce((sum, p) => sum + p.carbonCreditsPerYear, 0);
  
  const currentYear = new Date().getFullYear().toString();
  const currentYearRevenue = aggregatedRevenueByYear[currentYear] || 0;
  
  const totalRevenuePerYear = Math.round(totalCarbonCredits * 25);
  const agentCommissionPerYear = Math.round(totalRevenuePerYear * (agentCommissionPercentage / 100));
  const crunchCommissionPerYear = Math.round(totalRevenuePerYear * (crunchCommissionPercentage / 100));

  return {
    annualEnergyKwh: totalAnnualEnergy,
    carbonCreditsPerYear: totalCarbonCredits,
    clientSharePercentage,
    agentCommissionPercentage,
    totalRevenuePerYear,
    clientRevenuePerYear: currentYearRevenue,
    agentCommissionPerYear,
    crunchCommissionPerYear,
    systemSizeKwp: totalSystemSizeKwp,
    revenueByYear: aggregatedRevenueByYear,
    isMultiPhase: true,
    phases: phaseRevenues
  };
}

/**
 * kWh-mode calculation: revenue derived directly from user-supplied per-year kWh.
 * No yield factor. No pro-rating. System size displayed as a derived figure
 * (highest annual kWh / national avg yield factor) purely for dashboards.
 */
async function calculateFromAnnualKwh(
  specs: SystemSpecs,
  portfolioKWp?: number
): Promise<CarbonCalculationResult> {
  const carbonPrices = await dynamicCarbonPricingService.getCarbonPrices();
  const isMultiPhase = !!(specs.phases && specs.phases.length > 0);

  // Aggregate per-year kWh: single-phase uses specs.annualKwhByYear; multi-phase sums phase grids.
  const aggregatedKwhByYear: Record<string, number> = isMultiPhase
    ? sumByYear(...(specs.phases || []).map((p) => (p.annualKwhByYear as Record<string, number>) || undefined))
    : ((specs.annualKwhByYear as Record<string, number>) || {});

  // Derived system size from highest annual kWh (for portfolio displays).
  const peakAnnualKwh = Math.max(0, ...Object.values(aggregatedKwhByYear).map((v) => Number(v) || 0));
  const derivedSystemSizeKwp = peakAnnualKwh > 0 ? peakAnnualKwh / DEFAULT_ANNUAL_GENERATION_FACTOR : 0;

  const effectivePortfolioKWp = portfolioKWp || derivedSystemSizeKwp;
  const clientSharePercentage = specs.clientShareOverride ?? getClientSharePercentage(effectivePortfolioKWp);
  const agentCommissionPercentage = getAgentCommissionPercentage(effectivePortfolioKWp);
  const crunchCommissionPercentage = getCrunchCommissionPercentage(clientSharePercentage, agentCommissionPercentage);

  let aggregatedRevenueByYear: Record<string, number> = {};
  const phaseRevenues: PhaseRevenue[] = [];

  if (isMultiPhase) {
    for (const phase of specs.phases!) {
      const phaseKwh = (phase.annualKwhByYear as Record<string, number>) || {};
      const { revenueByYear, creditsByYear } = calculateRevenueByYearFromKwhSync(
        phaseKwh,
        DEFAULT_CARBON_FACTOR,
        clientSharePercentage,
        carbonPrices,
        specs.auditTags
      );
      aggregatedRevenueByYear = sumByYear(aggregatedRevenueByYear, revenueByYear);
      const phaseKwhValues = Object.values(phaseKwh).map((v) => Number(v) || 0);
      const avgAnnualKwh = averageNonZero(phaseKwhValues);
      const avgCredits = averageNonZero(Object.values(creditsByYear));
      phaseRevenues.push({
        phaseNumber: phase.phaseNumber,
        phaseName: phase.phaseName,
        sizeKWp: phase.sizeKWp || (avgAnnualKwh / DEFAULT_ANNUAL_GENERATION_FACTOR),
        commissionDate: phase.commissionDate,
        annualEnergyKwh: avgAnnualKwh,
        carbonCreditsPerYear: avgCredits,
        revenueByYear,
        annualKwhByYear: phase.annualKwhByYear,
      });
    }
  } else {
    const { revenueByYear } = calculateRevenueByYearFromKwhSync(
      aggregatedKwhByYear,
      DEFAULT_CARBON_FACTOR,
      clientSharePercentage,
      carbonPrices,
      specs.auditTags
    );
    aggregatedRevenueByYear = revenueByYear;
  }

  // Representative annual figures (avg across non-zero years).
  const kwhValues = Object.values(aggregatedKwhByYear).map((v) => Number(v) || 0);
  const annualEnergyKwh = averageNonZero(kwhValues);
  const carbonCreditsPerYear = (annualEnergyKwh / 1000) * DEFAULT_CARBON_FACTOR;

  const currentYear = new Date().getFullYear().toString();
  const currentYearRevenue = aggregatedRevenueByYear[currentYear] || 0;
  const totalRevenuePerYear = Math.round(carbonCreditsPerYear * 25);
  const agentCommissionPerYear = Math.round(totalRevenuePerYear * (agentCommissionPercentage / 100));
  const crunchCommissionPerYear = Math.round(totalRevenuePerYear * (crunchCommissionPercentage / 100));

  return {
    annualEnergyKwh,
    carbonCreditsPerYear,
    clientSharePercentage,
    agentCommissionPercentage,
    totalRevenuePerYear,
    clientRevenuePerYear: currentYearRevenue,
    agentCommissionPerYear,
    crunchCommissionPerYear,
    systemSizeKwp: derivedSystemSizeKwp,
    revenueByYear: aggregatedRevenueByYear,
    isMultiPhase,
    phases: isMultiPhase ? phaseRevenues : undefined,
  };
}
