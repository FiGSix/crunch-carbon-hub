import { supabase } from "@/integrations/supabase/client";
import { EligibilityCriteria, ClientInformation, ProjectInformation, ProjectPhase, AdditionalClient } from "@/types/proposals";
import { logger } from "@/lib/logger";
import { normalizeToKWp } from "@/lib/calculations/carbon/normalization";
import { calculateAnnualEnergy, calculateCarbonCredits } from "@/lib/calculations/carbon";
import type { Database } from "@/integrations/supabase/types";
import { devLogger } from '@/lib/performance/ConsoleReplacementUtility';
import { UnifiedCarbonService } from '@/services/calculations/carbon';
import type { SystemSpecs } from '@/services/calculations/carbon/types';
import { checkProposalDuplicate } from './duplicateReviewService';
import { normalizeProjectInfoForStorage } from '@/utils/proposals/normalizeProjectInfo';


type ProposalInsert = Database['public']['Tables']['proposals']['Insert'];

/**
 * Unified proposal service - handles all proposal operations in one place
 */

// Simple portfolio calculations
function calculateClientSharePercentage(portfolioKWp: number): number {
  if (portfolioKWp < 5000) return 60.20;  // 0-5MWp
  if (portfolioKWp < 10000) return 63;    // 5-10MWp
  if (portfolioKWp < 20000) return 66.5;  // 10-20MWp
  if (portfolioKWp < 30000) return 68.25; // 20-30MWp
  return 70; // 30+MWp
}

function calculateAgentCommissionPercentage(companyKWp: number): number {
  return companyKWp < 15000 ? 4 : 7;
}

/**
 * Find or create client using secure RPC function
 * This bypasses RLS to allow multi-agent collaboration
 */
async function findOrCreateClient(
  clientInfo: ClientInformation, 
  agentId: string
): Promise<string> {
  const normalizedEmail = clientInfo.email.toLowerCase().trim();
  const [firstName, ...lastNameParts] = clientInfo.name.split(' ');
  const lastName = lastNameParts.join(' ') || null;
  
  const proposalLogger = logger.withContext({
    component: 'UnifiedProposalService',
    method: 'findOrCreateClient'
  });
  
  try {
    proposalLogger.info("Resolving client via RPC", { 
      email: normalizedEmail,
      agentId 
    });
    
    // Call secure RPC function that bypasses RLS for email lookup
    const { data: clientId, error } = await supabase
      .rpc('find_or_create_client_by_email', {
        p_email: normalizedEmail,
        p_first_name: firstName || clientInfo.name,
        p_last_name: lastName,
        p_phone: clientInfo.phone || null,
        p_company_name: clientInfo.companyName || null,
        p_created_by: agentId
      });
    
    if (error) {
      proposalLogger.error("RPC call failed", { error });
      throw new Error(`Failed to process client: ${error.message}`);
    }
    
    if (!clientId) {
      proposalLogger.error("RPC returned no client ID");
      throw new Error('RPC function returned no client ID');
    }
    
    proposalLogger.info("Client resolved successfully", { 
      clientId,
      email: normalizedEmail 
    });
    
    return clientId;
    
  } catch (error: any) {
    proposalLogger.error("Error in findOrCreateClient", { error });
    
    // User-friendly error messages
    if (error.message?.includes('Email cannot be empty')) {
      throw new Error('Client email is required');
    }
    
    throw new Error(error.message || 'Failed to create or find client');
  }
}

// Get portfolio sizes
async function getPortfolioSize(query: any): Promise<number> {
  const { data } = await query;
  return data?.reduce((total: number, p: any) => total + (p.system_size_kwp || 0), 0) || 0;
}

/**
 * Create a proposal - unified function that handles everything
 */
export async function createProposal(
  proposalTitle: string,
  agentId: string,
  eligibilityCriteria: EligibilityCriteria,
  projectInfo: ProjectInformation,
  clientInfo: ClientInformation,
  selectedClientId?: string,
  additionalClients?: AdditionalClient[]
): Promise<{ success: boolean; proposalId?: string; error?: string }> {
  const proposalLogger = logger.withContext({
    component: 'UnifiedProposalService',
    method: 'createProposal'
  });

  try {
    // Step 1: Get agent profile to check approval status
    const { data: agentProfile } = await supabase
      .from('profiles')
      .select('agent_status, role')
      .eq('id', agentId)
      .single();

    // Check if agent is approved before proceeding
    if (agentProfile?.role === 'agent' && agentProfile?.agent_status === 'pending_approval') {
      proposalLogger.warn("Attempted proposal creation by pending agent", { agentId });
      return {
        success: false,
        error: "Your agent account must be approved before you can create proposals."
      };
    }

    proposalLogger.info("Creating proposal", { 
      proposalTitle, 
      agentId, 
      selectedClientId,
      projectSize: projectInfo.size,
      clientEmail: clientInfo.email
    });

    // Step 2: Handle client
    const clientId = selectedClientId || await findOrCreateClient(clientInfo, agentId);
    
    // Step 2.5: Check if client has existing cession agreement (master agreement check).
    // Defence-in-depth: only treat as returning if the referenced anchor proposal still
    // exists and is not soft-deleted. Prevents auto-signing when the original agreement
    // proposal has been deleted but the client row was not cleaned up.
    const { data: clientRecord } = await supabase
      .from('clients')
      .select('cession_signed_at, first_agreement_id')
      .eq('id', clientId)
      .single();

    let hasExistingAgreement = false;
    if (clientRecord?.cession_signed_at && clientRecord?.first_agreement_id) {
      const { data: anchorProposal } = await supabase
        .from('proposals')
        .select('id')
        .eq('id', clientRecord.first_agreement_id)
        .is('deleted_at', null)
        .maybeSingle();
      hasExistingAgreement = !!anchorProposal;

      if (!hasExistingAgreement) {
        proposalLogger.warn("Client cession_signed_at present but anchor proposal missing/deleted; treating as new client", {
          clientId,
          firstAgreementId: clientRecord.first_agreement_id
        });
      }
    }

    if (hasExistingAgreement) {
      proposalLogger.info("Auto-approving proposal for returning client", {
        clientId,
        cessionSignedAt: clientRecord!.cession_signed_at
      });
    }
    
    // Step 3: Calculate system values
    const isKwhMode = projectInfo.generationInputMode === 'kwh';
    const DEFAULT_YIELD = 1642.50; // matches DEFAULT_ANNUAL_GENERATION_FACTOR
    const EMISSION_FACTOR = 1.0334; // matches DEFAULT_CARBON_FACTOR

    let systemSizeKWp: number;
    let annualEnergy: number;
    let carbonCredits: number;

    if (isKwhMode) {
      // Aggregate per-year kWh across phases (multi-phase) or use single grid.
      const aggregateKwh: Record<string, number> = {};
      if (projectInfo.isMultiPhase && projectInfo.phases) {
        projectInfo.phases.forEach((p) => {
          Object.entries(p.annualKwhByYear || {}).forEach(([y, v]) => {
            aggregateKwh[y] = (aggregateKwh[y] || 0) + (Number(v) || 0);
          });
        });
      } else {
        Object.entries(projectInfo.annualKwhByYear || {}).forEach(([y, v]) => {
          aggregateKwh[y] = Number(v) || 0;
        });
      }
      const peakKwh = Math.max(0, ...Object.values(aggregateKwh));
      const nonZero = Object.values(aggregateKwh).filter((v) => v > 0);
      const avgKwh = nonZero.length ? nonZero.reduce((s, v) => s + v, 0) / nonZero.length : 0;
      systemSizeKWp = peakKwh > 0 ? peakKwh / DEFAULT_YIELD : 0;
      annualEnergy = avgKwh;
      carbonCredits = (avgKwh / 1000) * EMISSION_FACTOR;
    } else {
      systemSizeKWp = projectInfo.isMultiPhase && projectInfo.phases
        ? projectInfo.phases.reduce((sum, p) => sum + p.sizeKWp, 0)
        : normalizeToKWp(projectInfo.size) || 0;
      annualEnergy = calculateAnnualEnergy(systemSizeKWp);
      carbonCredits = calculateCarbonCredits(systemSizeKWp);
    }

    // Step 4a: Resolve agent's company (auto-creates solo company if needed)
    const { data: companyIdResolved, error: companyErr } = await supabase
      .rpc('ensure_agent_has_company', { p_agent_id: agentId });
    if (companyErr || !companyIdResolved) {
      proposalLogger.error('Failed to resolve agent company', { error: companyErr });
      throw new Error(companyErr?.message || 'Failed to resolve agent company');
    }
    const companyId = companyIdResolved as string;

    // Step 4a-ii: Fetch company-level commission override, client portfolio override,
    // and creator role in parallel.
    const [{ data: companyRow }, { data: clientRow }, { data: creatorProfile }] = await Promise.all([
      (supabase as any)
        .from('companies')
        .select('commission_override')
        .eq('id', companyId)
        .maybeSingle(),
      supabase
        .from('clients')
        .select('portfolio_client_share_override')
        .eq('id', clientId)
        .maybeSingle(),
      supabase
        .from('profiles')
        .select('role')
        .eq('id', agentId)
        .maybeSingle(),
    ]);
    const companyCommissionOverride: number | null =
      companyRow?.commission_override ?? null;
    const portfolioClientShareOverride: number | null =
      (clientRow as any)?.portfolio_client_share_override ?? null;
    const isAdminCreator = (creatorProfile as any)?.role === 'admin';

    // Step 4b: Portfolio sizes — client portfolio (per client) + company portfolio (per company)
    const [clientPortfolioKWp, companyPortfolioKWp] = await Promise.all([
      getPortfolioSize(
        supabase
          .from('proposals')
          .select('system_size_kwp')
          .eq('client_reference_id', clientId)
          .is('deleted_at', null)
          .not('system_size_kwp', 'is', null)
      ),
      getPortfolioSize(
        (supabase as any)
          .from('proposals')
          .select('system_size_kwp')
          .eq('company_id', companyId)
          .is('deleted_at', null)
          .not('system_size_kwp', 'is', null)
      )
    ]);

    const totalClientPortfolio = clientPortfolioKWp + systemSizeKWp;
    const totalCompanyPortfolio = companyPortfolioKWp + systemSizeKWp;

    const tierClientShare = calculateClientSharePercentage(totalClientPortfolio);
    const clientSharePercentage =
      portfolioClientShareOverride != null
        ? portfolioClientShareOverride
        : tierClientShare;

    // Admin-created proposals have no partner: commission is 0%.
    // Partner-created proposals use the company override if set, otherwise the MWp tier.
    const agentCommissionPercentage = isAdminCreator
      ? 0
      : (companyCommissionOverride != null
          ? companyCommissionOverride
          : calculateAgentCommissionPercentage(totalCompanyPortfolio));

    proposalLogger.info("Portfolio tier calculations (company-based)", {
      clientId,
      companyId,
      systemSizeKWp,
      clientPortfolioKWp,
      companyPortfolioKWp,
      totalClientPortfolio,
      totalCompanyPortfolio,
      tierClientShare,
      clientSharePercentage,
      portfolioClientShareOverride,
      agentCommissionPercentage,
      companyCommissionOverride,
      isAdminCreator,
      generationInputMode: projectInfo.generationInputMode || 'kwp',
    });

    // Step 5: Calculate total client revenue using UnifiedCarbonService
    const calculationSpecs: SystemSpecs = projectInfo.isMultiPhase && projectInfo.phases
      ? {
          sizeKwp: systemSizeKWp,
          phases: projectInfo.phases,
          commissionDate: projectInfo.phases[0]?.commissionDate,
          clientShareOverride: clientSharePercentage,
        }
      : {
          sizeKwp: systemSizeKWp,
          commissionDate: projectInfo.commissionDate,
          clientShareOverride: clientSharePercentage,
          annualKwhByYear: isKwhMode ? projectInfo.annualKwhByYear : undefined,
        };

    const { revenueByYear } = await UnifiedCarbonService.calculateComplete(
      calculationSpecs,
      totalClientPortfolio
    );

    const totalClientRevenue = Object.values(revenueByYear).reduce((sum: number, val: number) => sum + val, 0);

    const duplicateReviewId = await checkProposalDuplicate({
      agentId,
      clientId,
      title: proposalTitle,
      projectInfo,
      systemSizeKwp: systemSizeKWp,
    });

    // Step 6: Insert proposal (company_id anchors the proposal permanently)
    // Persist the size as a plain number; the typed wording lives in size_display.
    const storedProjectInfo = normalizeProjectInfoForStorage(projectInfo, systemSizeKWp);

    const proposalData = {
      title: proposalTitle,
      agent_id: agentId,
      company_id: companyId,
      client_reference_id: clientId,
      status: hasExistingAgreement ? 'approved' : 'draft',
      signed_at: hasExistingAgreement ? new Date().toISOString() : null,
      content: {
        title: proposalTitle,
        eligibilityCriteria,
        projectInfo: storedProjectInfo,
        clientInfo,
        additionalClients: additionalClients && additionalClients.length > 0 ? additionalClients : undefined,
        financials: {
          totalClientRevenue: Math.round(totalClientRevenue)
        }
      } as any,
      eligibility_criteria: eligibilityCriteria as any,
      project_info: storedProjectInfo as any,

      system_size_kwp: systemSizeKWp,
      annual_energy: annualEnergy,
      carbon_credits: carbonCredits,
      client_share_percentage: clientSharePercentage,
      agent_commission_percentage: agentCommissionPercentage,
      agent_portfolio_kwp: totalCompanyPortfolio,
      duplicate_review_id: duplicateReviewId,
      ...(portfolioClientShareOverride != null
        ? {
            client_share_override_enabled: true,
            client_share_override_set_at: new Date().toISOString(),
            client_share_override_set_by: agentId,
          }
        : {}),
    } as unknown as ProposalInsert;

    const { data: insertedProposal, error: insertError } = await supabase
      .from('proposals')
      .insert(proposalData)
      .select('id')
      .single();

    if (insertError) {
      proposalLogger.error("Failed to insert proposal", { error: insertError });
      throw insertError;
    }

    proposalLogger.info("Proposal created successfully", { 
      proposalId: insertedProposal.id,
      clientId,
      systemSizeKWp,
      clientSharePercentage,
      agentCommissionPercentage
    });

    // Step 7: Insert additional clients into proposal_clients junction table
    if (additionalClients && additionalClients.length > 0) {
      const additionalClientRows = [];
      
      for (const ac of additionalClients) {
        const acClientId = ac.clientId || await findOrCreateClient(
          { name: ac.name, email: ac.email, phone: ac.phone || "", companyName: ac.companyName || "", existingClient: !!ac.clientId },
          agentId
        );
        additionalClientRows.push({
          proposal_id: insertedProposal.id,
          client_id: acClientId,
          added_by: agentId,
        });
      }

      if (additionalClientRows.length > 0) {
        const { error: junctionError } = await supabase
          .from('proposal_clients')
          .insert(additionalClientRows);
        
        if (junctionError) {
          proposalLogger.warn("Failed to insert additional clients into proposal_clients", { error: junctionError });
          // Non-fatal: proposal was created, additional client linking failed
        } else {
          proposalLogger.info("Additional clients linked", { count: additionalClientRows.length });
        }
      }
    }

    return {
      success: true,
      proposalId: insertedProposal.id
    };

  } catch (error) {
    proposalLogger.error("Proposal creation failed", { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create proposal"
    };
  }
}

/**
 * Simple client search - uses secure RPC function
 */
export async function searchClients(searchTerm: string): Promise<Array<{
  id: string;
  name: string;
  email: string;
  company?: string;
  isRegistered: boolean;
}>> {
  try {
    const { data, error } = await supabase.rpc('search_clients', {
      search_term: searchTerm
    });

    if (error) {
      devLogger.clients.error("Client search error:", error);
      return [];
    }

    return (data || []).map(client => ({
      id: client.id,
      name: client.name,
      email: client.email,
      company: client.company,
      isRegistered: client.is_registered
    }));
  } catch (error) {
    devLogger.clients.error("Client search exception:", error);
    return [];
  }
}

export type { ProposalInsert };
