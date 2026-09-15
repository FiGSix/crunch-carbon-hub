import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import {
  ClientInformation,
  ProjectInformation,
  EligibilityCriteria,
  ProposalContent,
} from "@/types/proposals";
import {
  normalizeToKWp,
  calculateAnnualEnergy,
  calculateCarbonCredits,
  getClientSharePercentage,
  calculateRevenueByYear,
} from "@/services/calculations/carbon";
import { checkProposalDuplicate } from "@/services/proposals/duplicateReviewService";
import { normalizeProjectInfoForStorage } from "@/utils/proposals/normalizeProjectInfo";


interface ClientSubmissionResult {
  success: boolean;
  proposalId?: string;
  error?: string;
}

/**
 * Handles proposal creation when a client submits their own project.
 * 
 * - Looks up the client's `clients` record via user_id
 * - Builds ClientInformation from their record
 * - Calculates carbon values using existing utilities
 * - Sets agent_commission to 0% (no agent)
 * - Creates proposal with status 'draft'
 * - Notifies admins
 */
export async function submitClientProject(
  eligibility: EligibilityCriteria,
  projectInfo: ProjectInformation,
  userId: string
): Promise<ClientSubmissionResult> {
  try {
    // 1. Look up client record
    const { data: clientRecord, error: clientError } = await supabase
      .from("clients")
      .select("id, first_name, last_name, email, phone, company_name, registration_number")
      .eq("user_id", userId)
      .maybeSingle();

    if (clientError) throw new Error(`Failed to look up client record: ${clientError.message}`);
    if (!clientRecord) throw new Error("No client record found for your account. Please contact support.");

    // 2. Build client info from record
    const clientInfo: ClientInformation = {
      name: `${clientRecord.first_name || ""} ${clientRecord.last_name || ""}`.trim(),
      email: clientRecord.email,
      phone: clientRecord.phone || "",
      companyName: clientRecord.company_name || "",
      existingClient: true,
      registrationNumber: clientRecord.registration_number || undefined,
    };

    // 3. Calculate system values
    const systemSizeKWp = projectInfo.isMultiPhase
      ? projectInfo.totalSystemSize || 0
      : normalizeToKWp(projectInfo.size);

    const annualEnergy = calculateAnnualEnergy(systemSizeKWp);
    // BUGFIX: calculateCarbonCredits expects kWp, not kWh. Passing annualEnergy
    // produced credits ~1643× too high (ratio 2787.913 credits/kWp on 5 records).
    const carbonCredits = calculateCarbonCredits(systemSizeKWp);

    // 4. Get client portfolio size for tier pricing
    const { data: existingProposals } = await supabase
      .from("proposals")
      .select("system_size_kwp")
      .eq("client_reference_id", clientRecord.id)
      .is("deleted_at", null)
      .is("archived_at", null);

    const portfolioKWp = (existingProposals || []).reduce(
      (sum, p) => sum + (p.system_size_kwp || 0),
      0
    );

    // Respect admin-applied portfolio override when present
    const { data: clientPortfolioRow } = await supabase
      .from("clients")
      .select("portfolio_client_share_override")
      .eq("id", clientRecord.id)
      .maybeSingle();
    const portfolioClientShareOverride: number | null =
      (clientPortfolioRow as any)?.portfolio_client_share_override ?? null;

    const clientSharePercentage =
      portfolioClientShareOverride != null
        ? portfolioClientShareOverride
        : getClientSharePercentage(portfolioKWp);
    const agentCommissionPercentage = 0; // No agent

    // 5. Calculate revenue projections
    const clientRevenue = await calculateRevenueByYear(
      carbonCredits,
      clientSharePercentage,
      projectInfo.commissionDate
    );

    // 6. Build proposal content
    // Persist the size as a plain number; the typed wording lives in size_display.
    const storedProjectInfo = normalizeProjectInfoForStorage(projectInfo, systemSizeKWp);

    const content: ProposalContent = {
      clientInfo,
      projectInfo: storedProjectInfo,

      portfolioSize: portfolioKWp,
      clientSpecificRevenue: clientRevenue,
      agentCommissionRevenue: {},
      calculationMetadata: {
        portfolioBasedPricing: true,
        portfolioSize: portfolioKWp,
        calculatedAt: new Date().toISOString(),
        carbonPricesUsed: {},
      },
    };

    const title = `${clientInfo.companyName || clientInfo.name} - ${projectInfo.name}`;

    const duplicateReviewId = await checkProposalDuplicate({
      agentId: userId,
      clientId: clientRecord.id,
      title,
      projectInfo,
      systemSizeKwp: systemSizeKWp,
    });

    // 7. Insert proposal.
    //    A client submitting their own project is NOT the agent. Leaving agent_id
    //    (and the company anchor) unset keeps the project unassigned until an
    //    internal owner is allocated; the submitter is recorded via client_id.
    const proposalRow = {
      title,
      status: "draft" as const,
      client_id: userId,
      client_reference_id: clientRecord.id,
      agent_id: null,
      company_id: null,
      content: content as unknown as Json,
      eligibility_criteria: eligibility as unknown as Json,
      project_info: storedProjectInfo as unknown as Json,
      annual_energy: annualEnergy,
      carbon_credits: carbonCredits,
      client_share_percentage: clientSharePercentage,
      agent_commission_percentage: agentCommissionPercentage,
      agent_portfolio_kwp: 0,
      system_size_kwp: systemSizeKWp,
      duplicate_review_id: duplicateReviewId,
      ...(portfolioClientShareOverride != null
        ? {
            client_share_override_enabled: true,
            client_share_override_set_at: new Date().toISOString(),
            client_share_override_set_by: userId,
          }
        : {}),
    } as any;

    const { data: proposal, error: insertError } = await supabase
      .from("proposals")
      .insert(proposalRow)
      .select("id")
      .single();

    if (insertError) throw new Error(`Failed to create proposal: ${insertError.message}`);

    // 8. Notify admins
    const { data: admins } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "admin");

    if (admins?.length) {
      const notifications = admins.map((admin) => ({
        user_id: admin.id,
        type: "info",
        title: "New Client Project Submission",
        message: `${clientInfo.name} (${clientInfo.email}) has submitted a new project: ${projectInfo.name}`,
        related_type: "proposal",
        related_id: proposal.id,
      }));

      await supabase.from("notifications").insert(notifications);
    }

    return { success: true, proposalId: proposal.id };
  } catch (error: any) {
    console.error("Client project submission failed:", error);
    return { success: false, error: error.message };
  }
}
