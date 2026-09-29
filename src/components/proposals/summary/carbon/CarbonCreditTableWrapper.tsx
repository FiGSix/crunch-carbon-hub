import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { CarbonCreditTable } from "./CarbonCreditTable";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { PhaseRevenue } from "@/services/calculations/carbon/types";
import { 
  aggregateYearlyMWhFromPhases,
  aggregateYearlyCarbonCreditsFromPhases,
  calculateYearlyEnergy,
  calculateYearlyCarbonCredits
} from "./carbonCalculations";

interface CarbonCreditTableWrapperProps {
  isMultiPhase: boolean;
  phases: PhaseRevenue[];
  consolidatedRevenue: Record<string, number>;
  systemSizeKWp: number;
  commissionDate?: string;
  portfolioSize: number;
  totalMWhGenerated: number;
  totalCarbonCredits: number;
  totalClientSpecificRevenue: number;
  clientShareOverride?: number;
  preCalculatedYearlyMWh?: Record<string, number>;
  preCalculatedYearlyCredits?: Record<string, number>;
  preCalculatedYearlyRevenue?: Record<string, number>;
  isKwhMode?: boolean;
  auditTags?: readonly string[] | null;
}

export function CarbonCreditTableWrapper({
  isMultiPhase,
  phases,
  consolidatedRevenue,
  systemSizeKWp,
  commissionDate,
  portfolioSize,
  totalMWhGenerated,
  totalCarbonCredits,
  totalClientSpecificRevenue,
  clientShareOverride,
  preCalculatedYearlyMWh,
  preCalculatedYearlyCredits,
  preCalculatedYearlyRevenue,
  isKwhMode,
  auditTags
}: CarbonCreditTableWrapperProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Single-phase: Show table directly
  if (!isMultiPhase || phases.length === 0) {
    return (
      <CarbonCreditTable
        revenue={consolidatedRevenue}
        systemSizeKWp={systemSizeKWp}
        commissionDate={commissionDate}
        portfolioSize={portfolioSize}
        totalMWhGenerated={totalMWhGenerated}
        totalCarbonCredits={totalCarbonCredits}
        totalClientSpecificRevenue={totalClientSpecificRevenue}
        isPhaseTable={false}
        clientShareOverride={clientShareOverride}
        preCalculatedYearlyMWh={preCalculatedYearlyMWh}
        preCalculatedYearlyCredits={preCalculatedYearlyCredits}
        preCalculatedYearlyRevenue={preCalculatedYearlyRevenue}
      />
    );
  }

  // Helper function to calculate phase totals
  const calculatePhaseTotalMWh = (phase: PhaseRevenue) => {
    // Sum actual yearly MWh values for this phase
    const years = Object.keys(phase.revenueByYear);
    return years.reduce((sum, year) => {
      const yearlyEnergy = calculateYearlyEnergy(
        phase.sizeKWp,
        parseInt(year),
        phase.commissionDate,
        undefined,
        auditTags
      );
      return sum + (yearlyEnergy / 1000); // Convert to MWh
    }, 0);
  };

  const calculatePhaseTotalCredits = (phase: PhaseRevenue) => {
    // Sum actual yearly carbon credits for this phase
    const years = Object.keys(phase.revenueByYear);
    return years.reduce((sum, year) => {
      const yearlyCredits = calculateYearlyCarbonCredits(
        phase.sizeKWp,
        parseInt(year),
        phase.commissionDate,
        undefined,
        auditTags
      );
      return sum + yearlyCredits;
    }, 0);
  };

  const calculatePhaseTotalRevenue = (phase: PhaseRevenue) => {
    return Object.values(phase.revenueByYear).reduce((sum, val) => sum + val, 0);
  };

  // Multi-phase: Collapsible UI
  return (
    <div>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <Button 
            variant="ghost" 
            className="w-full justify-between mb-4 hover:bg-muted"
          >
            <span className="text-sm font-medium">
              {isExpanded ? 'Hide' : 'View'} Phase Breakdown ({phases.length} Phases)
            </span>
            <ChevronDown 
              className={`h-4 w-4 transition-transform duration-200 ${
                isExpanded ? 'rotate-180' : ''
              }`} 
            />
          </Button>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <div className="space-y-6 mb-6">
            {phases.map((phase) => {
              const phaseKwhGrid = (phase as any).annualKwhByYear as Record<string, number> | undefined;
              const phaseKwhMode = isKwhMode && phaseKwhGrid && Object.values(phaseKwhGrid).some((v) => (Number(v) || 0) > 0);
              const phasePreMWh = phaseKwhMode
                ? Object.fromEntries(Object.entries(phaseKwhGrid!).map(([y, kwh]) => [y, (Number(kwh) || 0) / 1000]))
                : undefined;
              const phasePreCredits = phaseKwhMode
                ? Object.fromEntries(Object.entries(phaseKwhGrid!).map(([y, kwh]) => [y, ((Number(kwh) || 0) / 1000) * 1.0334]))
                : undefined;
              const phasePreRevenue = phaseKwhMode ? phase.revenueByYear : undefined;
              const phaseTotalMWh = phasePreMWh
                ? Object.values(phasePreMWh).reduce((s, v) => s + v, 0)
                : calculatePhaseTotalMWh(phase);
              const phaseTotalCredits = phasePreCredits
                ? Object.values(phasePreCredits).reduce((s, v) => s + v, 0)
                : calculatePhaseTotalCredits(phase);
              return (
                <div key={phase.phaseNumber} className="border border-border rounded-lg p-4 bg-muted/30">
                  <h5 className="font-semibold mb-3 text-foreground">
                    Phase {phase.phaseNumber}{phase.phaseName ? `: ${phase.phaseName}` : ''}
                    <span className="text-sm font-normal text-muted-foreground ml-2">
                      ({phase.sizeKWp.toFixed(2)} kWp)
                    </span>
                  </h5>
                  <CarbonCreditTable
                    revenue={phase.revenueByYear}
                    systemSizeKWp={phase.sizeKWp}
                    commissionDate={phase.commissionDate}
                    portfolioSize={portfolioSize}
                    totalMWhGenerated={phaseTotalMWh}
                    totalCarbonCredits={phaseTotalCredits}
                    totalClientSpecificRevenue={calculatePhaseTotalRevenue(phase)}
                    isPhaseTable={true}
                    clientShareOverride={clientShareOverride}
                    preCalculatedYearlyMWh={phasePreMWh}
                    preCalculatedYearlyCredits={phasePreCredits}
                    preCalculatedYearlyRevenue={phasePreRevenue}
                  />
                </div>
              );
            })}
          </div>
        </CollapsibleContent>
      </Collapsible>
      
      <div className="border-t-2 border-primary/20 pt-6 mt-6">
        <h5 className="font-semibold mb-3 text-foreground">
          Consolidated Total (All Phases)
        </h5>
        <CarbonCreditTable
          revenue={consolidatedRevenue}
          systemSizeKWp={systemSizeKWp}
          commissionDate={commissionDate}
          portfolioSize={portfolioSize}
          totalMWhGenerated={totalMWhGenerated}
          totalCarbonCredits={totalCarbonCredits}
          totalClientSpecificRevenue={totalClientSpecificRevenue}
          preCalculatedYearlyMWh={preCalculatedYearlyMWh ?? aggregateYearlyMWhFromPhases(phases, Object.keys(consolidatedRevenue), auditTags)}
          preCalculatedYearlyCredits={preCalculatedYearlyCredits ?? aggregateYearlyCarbonCreditsFromPhases(phases, Object.keys(consolidatedRevenue), auditTags)}
          preCalculatedYearlyRevenue={preCalculatedYearlyRevenue}
          isPhaseTable={false}
          clientShareOverride={clientShareOverride}
        />
      </div>
    </div>
  );
}
