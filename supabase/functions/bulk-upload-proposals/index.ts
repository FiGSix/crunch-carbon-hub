import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "../_shared/types.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface BulkProposalRow {
  proposal_title: string;
  client_email: string;
  client_first_name: string;
  client_last_name: string;
  client_phone?: string;
  client_company_name?: string;
  project_name: string;
  project_address: string;
  system_size: number;
  system_size_unit: 'kWp' | 'MWp';
  commission_date: string;
  in_south_africa: boolean;
  not_registered: boolean;
  under_15mwp: boolean;
  commissioned_after_2022: boolean;
  legal_ownership: boolean;
  additional_notes?: string;
  assigned_agent_email?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Verify user is an agent or admin with active status
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, agent_status')
      .eq('id', user.id)
      .single();

    if (!profile || !['agent', 'admin'].includes(profile.role)) {
      throw new Error('Agent or Admin access required');
    }

    // Agents must have active status (admins bypass this check)
    if (profile.role === 'agent' && profile.agent_status !== 'active') {
      throw new Error('Agent account must be active to perform bulk uploads');
    }

    const { proposals } = await req.json() as { proposals: BulkProposalRow[] };

    console.log(`Processing ${proposals.length} proposals for ${profile.role} ${user.id}`);

    const results = {
      success: true,
      totalRows: proposals.length,
      successCount: 0,
      failureCount: 0,
      skippedDuplicates: 0,
      errors: [] as Array<{ row: number; data: Partial<BulkProposalRow>; error: string; isDuplicate?: boolean }>,
      createdProposalIds: [] as string[]
    };

    // Process each proposal
    for (let i = 0; i < proposals.length; i++) {
      const proposal = proposals[i];
      const rowNum = i + 3; // Account for header rows

      try {
        // Determine which agent should own this proposal
        let assignedAgentId = user.id; // Default to uploader (agent or admin)

        if (proposal.assigned_agent_email) {
          console.log(`Looking up agent: ${proposal.assigned_agent_email}`);
          
          const { data: agentProfile, error: agentError } = await supabase
            .from('profiles')
            .select('id, role, agent_status')
            .eq('email', proposal.assigned_agent_email.trim().toLowerCase())
            .single();
          
          if (agentError || !agentProfile) {
            throw new Error(`Agent not found: ${proposal.assigned_agent_email}`);
          }
          
          // Verify the user is an active agent
          if (agentProfile.role !== 'agent' || agentProfile.agent_status !== 'active') {
            throw new Error(`User ${proposal.assigned_agent_email} is not an active agent`);
          }
          
          assignedAgentId = agentProfile.id;
          console.log(`✅ Assigned to agent: ${proposal.assigned_agent_email} (${assignedAgentId})`);
        } else {
          console.log(`ℹ️ No agent specified, assigning to uploader: ${user.id}`);
        }

        // Hard business rule: a partner may not list themselves as the client
        if (
          profile.role !== 'admin' &&
          (proposal.client_email || '').trim().toLowerCase() ===
            (user.email || '').trim().toLowerCase()
        ) {
          throw new Error(
            "You cannot list yourself as the client. A partner may not act as both partner and client on the same proposal. Enter your client's email address — a colleague at your company can be added instead."
          );
        }

        // Find or create client
        let clientId: string;
        
        const { data: existingClient, error: clientLookupError } = await supabase
          .from('clients')
          .select('id')
          .eq('email', proposal.client_email)
          .single();

        // If error exists and it's NOT "no rows found", throw it
        if (clientLookupError && clientLookupError.code !== 'PGRST116') {
          throw new Error(`Failed to lookup client: ${clientLookupError.message}`);
        }

        if (existingClient) {
          clientId = existingClient.id;
        } else {
          const { data: newClient, error: clientError } = await supabase
            .from('clients')
            .insert({
              email: proposal.client_email,
              first_name: proposal.client_first_name,
              last_name: proposal.client_last_name,
              phone: proposal.client_phone,
              company_name: proposal.client_company_name,
              created_by: user.id
            })
            .select('id')
            .single();

          if (clientError) throw new Error(`Failed to create client: ${clientError.message}`);
          clientId = newClient.id;
        }

        // ====== DUPLICATE DETECTION (Address + Commission Date) ======
        // Check for existing proposal with same client + project address + commission date
        // This allows legitimate multi-installation properties (same address, different commission dates)
        const normalizedAddress = (proposal.project_address || '').trim().toLowerCase();
        const normalizedCommissionDate = (proposal.commission_date || '').trim();
        
        const { data: existingProposals } = await supabase
          .from('proposals')
          .select('id, title, project_info')
          .eq('client_reference_id', clientId)
          .is('deleted_at', null);

        // Check if any existing proposal has matching address AND commission date
        const duplicateProposal = existingProposals?.find(p => {
          const existingAddress = ((p.project_info as any)?.address || '').toLowerCase().trim();
          const existingCommissionDate = ((p.project_info as any)?.commissionDate || '').trim();
          // Only consider it a duplicate if BOTH address AND commission date match
          return normalizedAddress && existingAddress && existingAddress === normalizedAddress &&
                 normalizedCommissionDate && existingCommissionDate && existingCommissionDate === normalizedCommissionDate;
        });

        if (duplicateProposal) {
          const errorMsg = `Duplicate: Proposal already exists for "${proposal.client_email}" at "${proposal.project_address}" commissioned ${proposal.commission_date}`;
          console.log(`⚠️ Row ${rowNum}: ${errorMsg}`);
          results.skippedDuplicates++;
          results.failureCount++;
          results.errors.push({
            row: rowNum,
            data: proposal,
            error: errorMsg,
            isDuplicate: true
          });
          continue; // Skip to next proposal
        }
        // ====== END DUPLICATE DETECTION ======

        // Check if client has existing cession agreement (master agreement check)
        const { data: clientRecord } = await supabase
          .from('clients')
          .select('cession_signed_at')
          .eq('id', clientId)
          .single();

        const hasExistingAgreement = !!clientRecord?.cession_signed_at;
        
        if (hasExistingAgreement) {
          console.log(`✅ Auto-approving proposal for returning client (cession signed ${clientRecord.cession_signed_at})`);
        }

        // Convert system size to kWp
        const systemSizeKwp = proposal.system_size_unit === 'MWp' 
          ? proposal.system_size * 1000 
          : proposal.system_size;

        // Get CLIENT's portfolio for pricing calculations (correct approach)
        const { data: clientProposals } = await supabase
          .from('proposals')
          .select('system_size_kwp')
          .eq('client_reference_id', clientId)
          .is('deleted_at', null);

        const clientPortfolioKwp = (clientProposals || []).reduce((sum, p) => sum + (p.system_size_kwp || 0), 0);

        // Get AGENT's portfolio separately (for agent_portfolio_kwp field)
        const { data: agentProposals } = await supabase
          .from('proposals')
          .select('system_size_kwp')
          .eq('agent_id', assignedAgentId)
          .is('deleted_at', null);

        const agentPortfolioKwp = (agentProposals || []).reduce((sum, p) => sum + (p.system_size_kwp || 0), 0);

        // Calculate client share percentage based on CLIENT's portfolio using correct tiers (always auto-calculated)
        let clientSharePercentage = 60.20; // Default: 0-5MWp
        if (clientPortfolioKwp >= 30000) clientSharePercentage = 70;      // 30+MWp
        else if (clientPortfolioKwp >= 20000) clientSharePercentage = 68.25; // 20-30MWp
        else if (clientPortfolioKwp >= 10000) clientSharePercentage = 66.5;  // 10-20MWp
        else if (clientPortfolioKwp >= 5000) clientSharePercentage = 63;     // 5-10MWp

        // Get agent commission from agent's profile or use default (always auto-calculated)
        const { data: agentProfile } = await supabase
          .from('profiles')
          .select('commission_override')
          .eq('id', assignedAgentId)
          .single();

        const agentCommissionPercentage = agentProfile?.commission_override ?? 
          (agentPortfolioKwp >= 15000 ? 7 : 4);

        // Simple carbon credit calculation (actual calculation is more complex)
        // Using approximate values for demonstration
        const annualEnergyKwh = systemSizeKwp * 1600; // ~1600 kWh per kWp per year in SA
        const carbonCreditsPerYear = (annualEnergyKwh * 0.95) / 1000; // ~0.95 kg CO2 per kWh

        // Create proposal
        const { data: newProposal, error: proposalError } = await supabase
          .from('proposals')
          .insert({
            title: proposal.proposal_title,
            agent_id: assignedAgentId,
            client_reference_id: clientId,
            status: hasExistingAgreement ? 'approved' : 'draft', // Removed 'pending' - all new proposals start as 'draft'
            signed_at: hasExistingAgreement ? new Date().toISOString() : null,
            system_size_kwp: systemSizeKwp,
            unit_standard: 'kWp',
            annual_energy: annualEnergyKwh,
            carbon_credits: carbonCreditsPerYear,
            client_share_percentage: clientSharePercentage,
            agent_commission_percentage: agentCommissionPercentage,
            agent_portfolio_kwp: agentPortfolioKwp,
            client_portfolio_kwp: clientPortfolioKwp,
            eligibility_criteria: {
              inSouthAfrica: proposal.in_south_africa,
              notRegistered: proposal.not_registered,
              under15MWp: proposal.under_15mwp,
              commissionedAfter2022: proposal.commissioned_after_2022,
              legalOwnership: proposal.legal_ownership
            },
            project_info: {
              name: proposal.project_name,
              address: proposal.project_address,
              commissionDate: proposal.commission_date,
              size: systemSizeKwp,
              notes: proposal.additional_notes
            },
            content: {
              clientInfo: {
                firstName: proposal.client_first_name,
                lastName: proposal.client_last_name,
                email: proposal.client_email,
                phone: proposal.client_phone,
                companyName: proposal.client_company_name
              },
              projectInfo: {
                name: proposal.project_name,
                address: proposal.project_address,
                commissionDate: proposal.commission_date,
                size: systemSizeKwp
              }
            }
          })
          .select('id')
          .single();

        if (proposalError) throw new Error(`Failed to create proposal: ${proposalError.message}`);

        results.successCount++;
        results.createdProposalIds.push(newProposal.id);
        console.log(`✓ Row ${rowNum}: Created proposal ${newProposal.id}`);

      } catch (error) {
        results.failureCount++;
        results.errors.push({
          row: rowNum,
          data: proposal,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        console.error(`✗ Row ${rowNum}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    console.log(`Bulk upload complete: ${results.successCount} success, ${results.failureCount} failed, ${results.skippedDuplicates} duplicates skipped`);

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('Bulk upload error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    );
  }
});
