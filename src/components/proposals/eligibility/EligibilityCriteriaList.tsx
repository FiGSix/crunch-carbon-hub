

import { EligibilityCriteriaItem } from "./EligibilityCriteriaItem";
import { EligibilityCriteria } from "@/types/proposals";

interface EligibilityCriteriaListProps {
  eligibility: EligibilityCriteria;
  toggleEligibility: (field: keyof EligibilityCriteria) => void;
}

export function EligibilityCriteriaList({
  eligibility,
  toggleEligibility
}: EligibilityCriteriaListProps) {
  // Define criteria with their descriptions
  const criteriaDefinitions = [
    {
      id: "inSouthAfrica" as keyof EligibilityCriteria,
      title: "The project is located in South Africa",
      description: "The renewable energy system must be physically located within South Africa."
    },
    {
      id: "notRegistered" as keyof EligibilityCriteria,
      title: "Not registered in another GHG program",
      description: "The project is not currently registered under any other greenhouse gas reduction program."
    },
    {
      id: "under15MWp" as keyof EligibilityCriteria,
      title: "The system is under 15,000 kWp in capacity",
      description: "The total capacity of the renewable energy system must be less than 15,000 kWp."
    },
    {
      id: "commissionedAfter2022" as keyof EligibilityCriteria,
      title: "Commissioned on or after 1 July 2026",
      description: "The system must have been commissioned (put into operation) on or after 1 July 2026 (Verra VCS rules for newly onboarded projects)."
    },
    {
      id: "legalOwnership" as keyof EligibilityCriteria,
      title: "Legal ownership of system or green attributes",
      description: "The client must have legal ownership of either the renewable energy system or its green attributes."
    },
    {
      id: "noGovernmentFunding" as keyof EligibilityCriteria,
      title: "South African Government Funding Initiatives",
      description: "The project is not participating in any South African Government funded initiatives."
    }
  ];

  return (
    <div className="space-y-4">
      {criteriaDefinitions.map(criteria => (
        <EligibilityCriteriaItem
          key={criteria.id}
          id={criteria.id}
          title={criteria.title}
          description={criteria.description}
          checked={eligibility[criteria.id]}
          onCheckedChange={() => toggleEligibility(criteria.id)}
        />
      ))}
    </div>
  );
}
