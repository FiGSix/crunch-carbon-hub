
import { useState, useEffect, useMemo } from 'react';
import { UnifiedCarbonService } from '@/services/calculations/carbon';
import { PortfolioData } from '@/services/proposals/portfolioService';
import { dataCache } from '@/lib/cache/UnifiedCache';
import { devLogger } from '@/lib/performance/ConsoleReplacementUtility';
import { ProjectPhase, AnnualKwhByYear } from '@/types/proposals';
import { useProposalAuditTags } from '@/hooks/audit/useProposalAuditTags';

interface UseRevenueCalculationsProps {
  systemSize: string;
  commissionDate?: string;
  portfolioData: PortfolioData | null;
  proposalId?: string | null;
  phases?: ProjectPhase[];
  isMultiPhase?: boolean;
  clientShareOverride?: number | null;
  /** Present when project uses kWh input mode (single-phase). */
  annualKwhByYear?: AnnualKwhByYear;
}

export function useRevenueCalculations({
  systemSize,
  commissionDate,
  portfolioData,
  proposalId,
  phases,
  isMultiPhase,
  clientShareOverride,
  annualKwhByYear,
}: UseRevenueCalculationsProps) {
  const [clientSpecificRevenue, setClientSpecificRevenue] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const auditTags = useProposalAuditTags(proposalId);
  const auditKey = auditTags.join(',');

  const systemSizeKWp = useMemo(() =>
    UnifiedCarbonService.normalizeToKWp(systemSize),
    [systemSize]
  );

  const kwhSignature = useMemo(() => {
    if (annualKwhByYear) return Object.entries(annualKwhByYear).map(([y, v]) => `${y}:${v ?? ''}`).join(',');
    if (phases && phases.some(p => p.annualKwhByYear)) {
      return phases.map(p => `${p.phaseNumber}:${Object.entries(p.annualKwhByYear || {}).map(([y, v]) => `${y}:${v ?? ''}`).join(',')}`).join('|');
    }
    return '';
  }, [annualKwhByYear, phases]);

  const cacheKey = useMemo(() => {
    const portfolioSize = portfolioData?.totalKWp || systemSizeKWp;
    const phaseKey = phases ? phases.map(p => `${p.sizeKWp}-${p.commissionDate}`).join('_') : 'no-phases';
    return `revenue_${systemSizeKWp}_${commissionDate || 'no-date'}_${portfolioSize}_${proposalId || 'no-id'}_${isMultiPhase ? 'multi' : 'single'}_${phaseKey}_${clientShareOverride || 'no-override'}_${kwhSignature || 'kwp'}_${auditKey || 'no-audit'}`;
  }, [systemSizeKWp, commissionDate, portfolioData?.totalKWp, proposalId, phases, isMultiPhase, clientShareOverride, kwhSignature, auditKey]);

  const [calculationResult, setCalculationResult] = useState<any>(null);

  useEffect(() => {
    const calculateRevenues = async () => {
      try {
        setLoading(true);

        const cachedResult = dataCache.get<Record<string, number>>(cacheKey);
        if (cachedResult) {
          devLogger.components.log('Using cached revenue calculation');
          setClientSpecificRevenue(cachedResult);
          setLoading(false);
          return;
        }

        const portfolioSize = portfolioData?.totalKWp || systemSizeKWp;

        const overrideValue = clientShareOverride != null ? clientShareOverride : undefined;
        const specs = phases && phases.length > 0
          ? { sizeKwp: systemSizeKWp, phases, clientShareOverride: overrideValue, auditTags }
          : { sizeKwp: systemSizeKWp, commissionDate, clientShareOverride: overrideValue, annualKwhByYear, auditTags };

        const result = await UnifiedCarbonService.calculateComplete(specs, portfolioSize);

        dataCache.set(cacheKey, result.revenueByYear, 5 * 60 * 1000);

        setClientSpecificRevenue(result.revenueByYear);
        setCalculationResult(result);
      } catch (error) {
        devLogger.components.error('Error calculating revenues:', error);
        setClientSpecificRevenue({});
        setCalculationResult(null);
      } finally {
        setLoading(false);
      }
    };

    calculateRevenues();
  }, [cacheKey, systemSizeKWp, commissionDate, portfolioData, auditKey]);

  return {
    calculationResult,
    clientSpecificRevenue,
    loading,
    systemSizeKWp,
    auditTags
  };
}
