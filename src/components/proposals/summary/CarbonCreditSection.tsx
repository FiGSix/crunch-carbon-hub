
import { Skeleton } from "@/components/ui/skeleton";
import { CarbonCreditTableWrapper } from "./carbon/CarbonCreditTableWrapper";
import { calculateAnnualEnergy, calculateCarbonCredits, normalizeToKWp } from "@/lib/calculations/carbon";
import { 
  calculateTotalMWhGenerated, 
  calculateTotalCarbonCredits,
  aggregateYearlyMWhFromPhases,
  aggregateYearlyCarbonCreditsFromPhases
} from "./carbon/carbonCalculations";
import { usePortfolioData } from "./carbon/hooks/usePortfolioData";
import { useRevenueCalculations } from "./carbon/hooks/useRevenueCalculations";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useRef } from "react";

interface CarbonCreditSectionProps {
  systemSize: string;
  commissionDate?: string;
  selectedClientId?: string | null;
  proposalId?: string | null;
  phases?: any[];
  isMultiPhase?: boolean;
  clientShareOverride?: number | null;
  annualKwhByYear?: import("@/types/proposals").AnnualKwhByYear;
  generationInputMode?: import("@/types/proposals").GenerationInputMode;
}

export function CarbonCreditSection({ systemSize, commissionDate, selectedClientId, proposalId, phases, isMultiPhase, clientShareOverride, annualKwhByYear, generationInputMode }: CarbonCreditSectionProps) {
  const { portfolioData, loading: portfolioLoading } = usePortfolioData({
    selectedClientId,
    systemSize,
    proposalId
  });

  const { 
    calculationResult,
    clientSpecificRevenue, 
    loading: revenueLoading, 
    systemSizeKWp: formSystemSizeKWp,
    auditTags
  } = useRevenueCalculations({
    systemSize,
    commissionDate,
    portfolioData,
    proposalId,
    phases,
    isMultiPhase,
    clientShareOverride,
    annualKwhByYear,
  });

  const loading = portfolioLoading || revenueLoading;

  // Detect kWh mode
  const hasKwhGrid =
    (annualKwhByYear && Object.values(annualKwhByYear).some((v) => (Number(v) || 0) > 0)) ||
    (phases && phases.some((p) => p.annualKwhByYear && Object.values(p.annualKwhByYear).some((v) => (Number(v) || 0) > 0)));
  const isKwhMode = generationInputMode === 'kwh' || !!hasKwhGrid;

  // In kWh mode, use the derived kWp from the engine so downstream displays don't get 0.
  const systemSizeKWp = isKwhMode && calculationResult?.systemSizeKwp
    ? calculationResult.systemSizeKwp
    : formSystemSizeKWp;

  // Extract multi-phase data from calculation result (for display in table)
  const calculatedPhases = calculationResult?.phases || [];
  const calculatedIsMultiPhase = calculationResult?.isMultiPhase || false;

  // Use client-specific revenue for display (this is what the client actually gets)
  const displayRevenue = clientSpecificRevenue;

  // Build pre-calculated per-year MWh / credits / revenue for kWh mode (single & multi-phase).
  const EMISSION_FACTOR = 1.0334;
  let preCalculatedYearlyMWh: Record<string, number> | undefined;
  let preCalculatedYearlyCredits: Record<string, number> | undefined;
  let preCalculatedYearlyRevenue: Record<string, number> | undefined;

  if (isKwhMode) {
    const aggregatedKwh: Record<string, number> = {};
    if (phases && phases.length > 0) {
      phases.forEach((p) => {
        const grid = (p.annualKwhByYear || {}) as Record<string, number | undefined>;
        Object.entries(grid).forEach(([y, v]) => {
          aggregatedKwh[y] = (aggregatedKwh[y] || 0) + (Number(v) || 0);
        });
      });
    } else if (annualKwhByYear) {
      Object.entries(annualKwhByYear).forEach(([y, v]) => {
        aggregatedKwh[y] = Number(v) || 0;
      });
    }
    preCalculatedYearlyMWh = Object.fromEntries(
      Object.entries(aggregatedKwh).map(([y, kwh]) => [y, kwh / 1000])
    );
    preCalculatedYearlyCredits = Object.fromEntries(
      Object.entries(aggregatedKwh).map(([y, kwh]) => [y, (kwh / 1000) * EMISSION_FACTOR])
    );
    preCalculatedYearlyRevenue = calculationResult?.revenueByYear;
  }

  // Calculate totals using helper functions
  // For multi-phase, aggregate from phases to respect individual commission dates
  const totalMWhGenerated = isKwhMode && preCalculatedYearlyMWh
    ? Object.values(preCalculatedYearlyMWh).reduce((s, v) => s + v, 0)
    : calculatedIsMultiPhase && calculatedPhases.length > 0
      ? Object.values(aggregateYearlyMWhFromPhases(calculatedPhases, Object.keys(displayRevenue), auditTags)).reduce((sum, val) => sum + val, 0)
      : calculateTotalMWhGenerated(systemSizeKWp, displayRevenue, commissionDate, auditTags);

  const totalCarbonCredits = isKwhMode && preCalculatedYearlyCredits
    ? Object.values(preCalculatedYearlyCredits).reduce((s, v) => s + v, 0)
    : calculatedIsMultiPhase && calculatedPhases.length > 0
      ? Object.values(aggregateYearlyCarbonCreditsFromPhases(calculatedPhases, Object.keys(displayRevenue), auditTags)).reduce((sum, val) => sum + val, 0)
      : calculateTotalCarbonCredits(systemSizeKWp, displayRevenue, commissionDate, auditTags);
  
  const totalClientSpecificRevenue = Object.values(clientSpecificRevenue).reduce((sum: number, val: number) => sum + val, 0);

  // Persist totalClientRevenue to proposal when calculated
  const lastSavedRevenue = useRef<number | null>(null);
  
  useEffect(() => {
    const persistRevenue = async () => {
      if (!proposalId || !totalClientSpecificRevenue || loading) return;
      
      const roundedRevenue = Math.round(totalClientSpecificRevenue);
      
      // Only update if value has changed
      if (lastSavedRevenue.current === roundedRevenue) return;
      
      try {
        const { data: currentProposal } = await supabase
          .from('proposals')
          .select('content')
          .eq('id', proposalId)
          .single();
        
        if (!currentProposal) return;
        
        const content = currentProposal.content as any;
        const currentRevenue = content?.financials?.totalClientRevenue;
        
        // Skip if already set to the same value
        if (currentRevenue === roundedRevenue) {
          lastSavedRevenue.current = roundedRevenue;
          return;
        }
        
        // Update the proposal with the calculated revenue
        await supabase
          .from('proposals')
          .update({
            content: {
              ...(typeof content === 'object' ? content : {}),
              financials: {
                ...(content?.financials || {}),
                totalClientRevenue: roundedRevenue
              }
            }
          })
          .eq('id', proposalId);
        
        lastSavedRevenue.current = roundedRevenue;
      } catch (error) {
        console.error('Failed to persist total client revenue:', error);
      }
    };
    
    persistRevenue();
  }, [proposalId, totalClientSpecificRevenue, loading]);

  if (loading) {
    return (
      <div>
        <h3 className="text-lg font-semibold mb-3 text-carbon-gray-900">Carbon Credit Projection</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  // Summary tiles: prefer engine values in kWh mode; otherwise the legacy kWp x yield computation.
  const annualEnergy = isKwhMode && calculationResult
    ? Math.round(calculationResult.annualEnergyKwh)
    : calculateAnnualEnergy(systemSizeKWp);
  const carbonCredits = isKwhMode && calculationResult
    ? calculationResult.carbonCreditsPerYear
    : calculateCarbonCredits(systemSizeKWp);

  return (
    <div>
      <h3 className="text-lg font-semibold mb-3 text-carbon-gray-900">Carbon Credit Projection</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-sm text-carbon-gray-500">Estimated Annual Energy</p>
          <p className="font-medium">{annualEnergy.toLocaleString()} kWh</p>
        </div>
        <div>
          <p className="text-sm text-carbon-gray-500">Estimated Annual Carbon Credits</p>
          <p className="font-medium">{carbonCredits.toFixed(2)} tCO₂</p>
        </div>
      </div>
      
      <h4 className="font-medium text-carbon-gray-700 mb-2">Client Revenue by Year</h4>
      
      <CarbonCreditTableWrapper
        isMultiPhase={calculatedIsMultiPhase}
        phases={calculatedPhases}
        consolidatedRevenue={displayRevenue}
        systemSizeKWp={systemSizeKWp}
        commissionDate={commissionDate}
        portfolioSize={portfolioData?.totalKWp || systemSizeKWp}
        totalMWhGenerated={totalMWhGenerated}
        totalCarbonCredits={totalCarbonCredits}
        totalClientSpecificRevenue={totalClientSpecificRevenue}
        clientShareOverride={clientShareOverride ?? undefined}
        preCalculatedYearlyMWh={preCalculatedYearlyMWh}
        preCalculatedYearlyCredits={preCalculatedYearlyCredits}
        preCalculatedYearlyRevenue={preCalculatedYearlyRevenue}
        isKwhMode={isKwhMode}
        auditTags={auditTags}
      />
      
      <p className="text-xs text-carbon-gray-500 mt-2">
        * Eligible generation starts {formatEligibleStart(getEligibleStartDate(commissionDate, auditTags))}
        {auditTags.length > 0 ? ` (${auditTags.join(' · ')})` : ' (not in Audit 1 or Audit 2)'}
      </p>
      {commissionDate && !isKwhMode && (
        <p className="text-xs text-carbon-gray-500 mt-2">
          * Values for the first eligible year are pro-rated from that date
        </p>
      )}
      {isKwhMode && (
        <p className="text-xs text-carbon-gray-500 mt-2">
          * Generation source: user-supplied kWh per year (no pro-rating applied)
        </p>
      )}
    </div>
  );
}
