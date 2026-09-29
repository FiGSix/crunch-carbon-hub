import { UserRole } from '@/contexts/auth/types';
import { ProjectPhase, AnnualKwhByYear } from '@/types/proposals';

export interface SystemSpecs {
  sizeKwp: number;
  location?: string;
  unitStandard?: 'kWp' | 'MWp';
  commissionDate?: string | Date;
  phases?: ProjectPhase[];
  province?: string;
  clientShareOverride?: number;
  /**
   * When provided (single-phase), per-year user-supplied kWh override yield-factor calculation.
   * For multi-phase, populate `phases[].annualKwhByYear` instead.
   */
  annualKwhByYear?: AnnualKwhByYear;
  /**
   * Audit rounds this project belongs to ('Audit 1' | 'Audit 2' | 'Audit 3').
   * Determines the earliest claimable generation date. Untagged projects
   * (all new proposals) start on 1 July 2026.
   */
  auditTags?: readonly string[] | null;
}

export interface PhaseRevenue {
  phaseNumber: number;
  phaseName?: string;
  sizeKWp: number;
  commissionDate: string;
  revenueByYear: Record<string, number>;
  carbonCreditsPerYear: number;
  annualEnergyKwh: number;
  annualKwhByYear?: AnnualKwhByYear;
}

export interface CarbonCalculationResult {
  annualEnergyKwh: number;
  carbonCreditsPerYear: number;
  clientSharePercentage: number;
  agentCommissionPercentage: number;
  totalRevenuePerYear: number;
  clientRevenuePerYear: number;
  agentCommissionPerYear: number;
  crunchCommissionPerYear: number;
  systemSizeKwp: number;
  revenueByYear: Record<string, number>;
  // Multi-phase data
  isMultiPhase?: boolean;
  phases?: PhaseRevenue[];
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export interface PortfolioTotals {
  totalSystemSizeKwp: number;
  totalCarbonCredits: number;
  totalAnnualEnergy: number;
  totalRevenue: number;
}