
import { supabase } from '@/integrations/supabase/client';
import { ProposalListItem } from '@/types/proposals';
import { CacheManager } from '../cache/CacheManager';
import { RoleValidator } from '../utils/RoleValidator';
import { ErrorHandler } from '../utils/ErrorHandler';
import { transformToProposalListItems } from '@/utils/proposals/simplifiedTransformers';
import { UserRole } from '@/contexts/auth/types';
import type { Database } from '@/integrations/supabase/types';

type ProposalRow = Database['public']['Tables']['proposals']['Row'];

// Create a minimal profile type for this service
type MinimalProfile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
};

/**
 * Proposals data operations with enhanced security validation
 */
export class ProposalsDataService {
  static async getProposals(userId: string, userRole: UserRole, forceRefresh = false): Promise<ProposalListItem[]> {
    const cacheKey = CacheManager.getCacheKey('proposals', userId, userRole);
    
    if (!forceRefresh) {
      const cached = CacheManager.getFromCache<ProposalListItem[]>(cacheKey);
      if (cached) return cached;
    }

    try {
      // Kept as a plain string so the JSON-path selects below don't blow up
      // TypeScript's generated query types.
      const PROPOSAL_LIST_SELECT: string = `
          id,
          title,
          status,
          created_at,
          signed_at,
          archived_at,
          deleted_at,
          review_later_until,
          client_id,
          client_reference_id,
          agent_id,
          clientInfo:content->clientInfo,
          projectInfo:content->projectInfo,
          annual_energy,
          carbon_credits,
          client_share_percentage,
          client_share_override_enabled,
          agent_commission_percentage,
          agent_portfolio_kwp,
          system_size_kwp,
          unit_standard,
          invitation_sent_at,
          invitation_viewed_at,
          invitation_expires_at,
          last_email_event_type,
          last_email_sent_at,
          engagement_count,
          last_engagement_at
        `)
        .is('deleted_at', null); // Exclude soft-deleted proposals

      // Apply role-based filtering - RLS will handle the actual security
      if (userRole === 'client') {
        // Get user's client company membership
        const { data: membership } = await supabase
          .from('client_company_members')
          .select('client_company_id')
          .eq('user_id', userId)
          .eq('status', 'active');

        const companyIds = membership?.map(m => m.client_company_id) || [];

        if (companyIds.length > 0) {
          // Get all client record IDs in user's company
          const { data: companyClients } = await supabase
            .from('clients')
            .select('id')
            .in('client_company_id', companyIds);

          const companyClientIds = companyClients?.map(c => c.id) || [];

          // Filter: direct match OR company client reference match
          const filters = [`client_id.eq.${userId}`];
          if (companyClientIds.length > 0) {
            filters.push(`client_reference_id.in.(${companyClientIds.join(',')})`);
          }
          query = query.or(filters.join(','));
        } else {
          // No company -- fall back to direct match only
          query = query.or(`client_id.eq.${userId},client_reference_id.eq.${userId}`);
        }
      } else if (userRole === 'agent') {
        // Get user's company members to show all team proposals
        const { data: companyMembers } = await supabase
          .from('company_members')
          .select('company_id, user_id')
          .eq('status', 'active');

        // Find user's companies
        const userCompanyIds = companyMembers
          ?.filter(cm => cm.user_id === userId)
          .map(cm => cm.company_id) || [];

        if (userCompanyIds.length > 0) {
          // Get all agent IDs from user's companies
          const teamAgentIds = companyMembers
            ?.filter(cm => userCompanyIds.includes(cm.company_id))
            .map(cm => cm.user_id) || [];

          // Include user's own ID even if not in a company
          const allAgentIds = [...new Set([...teamAgentIds, userId])];
          query = query.in('agent_id', allAgentIds);
        } else {
          // No company membership - show only own proposals
          query = query.eq('agent_id', userId);
        }
      }
      // Admin role gets all non-deleted proposals (no additional filter needed)

      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) {
        const errorResult = ErrorHandler.handleRLSError(error, 'proposals fetch');
        if (errorResult.requiresReauth) {
          window.dispatchEvent(new CustomEvent('auth-required'));
        }
        return [];
      }

      if (!data) return [];

      // Get unique client and agent IDs to fetch profiles
      const clientIds = new Set<string>();
      const agentIds = new Set<string>();

      data.forEach((proposal: any) => {
        if (proposal.client_id) clientIds.add(proposal.client_id);
        if (proposal.client_reference_id) clientIds.add(proposal.client_reference_id);
        if (proposal.agent_id) agentIds.add(proposal.agent_id);
      });

      // Fetch client profiles
      let clientProfiles: MinimalProfile[] = [];
      if (clientIds.size > 0) {
        const { data: clientData, error: clientError } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email')
          .in('id', Array.from(clientIds));

        if (!clientError && clientData) {
          clientProfiles = clientData;
        }
      }

      // Fetch agent profiles
      let agentProfiles: MinimalProfile[] = [];
      if (agentIds.size > 0) {
        const { data: agentData, error: agentError } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email')
          .in('id', Array.from(agentIds));

        if (!agentError && agentData) {
          agentProfiles = agentData;
        }
      }

      // Rebuild the narrow content shape the transformers expect. Only the
      // clientInfo/projectInfo branches are fetched, not the full payload.
      const rows = (data as any[]).map((proposal) => ({
        ...proposal,
        content: {
          clientInfo: proposal.clientInfo ?? undefined,
          projectInfo: proposal.projectInfo ?? undefined,
        },
      }));

      // Transform proposals using the utility function
      const proposals = transformToProposalListItems(
        rows,
        clientProfiles,
        agentProfiles,
        userRole
      );

      CacheManager.setCache(cacheKey, proposals);
      return proposals;
    } catch (error) {
      console.error('Error fetching proposals:', error);
      ErrorHandler.logSecurityEvent({
        type: 'access_denied',
        userId,
        resource: 'proposals',
        action: 'list',
        details: error
      });
      return [];
    }
  }
}
