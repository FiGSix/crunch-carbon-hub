
import { supabase } from "@/lib/supabase/client";
import { logger } from "@/lib/logger";
import { buildBaseProposalsQuery } from "./queryBuilders";
import { RawProposalData, ProposalFilters } from "../types";
import { UserRole } from "@/contexts/auth/types";
import type { Database } from '@/integrations/supabase/types';

type ProposalRow = Database['public']['Tables']['proposals']['Row'];

/**
 * Core function to fetch proposals from Supabase
 * Returns the raw proposal data for further processing
 */
export async function fetchProposalsCore(
  userId: string,
  userRole: UserRole | null,
  filters: ProposalFilters
): Promise<RawProposalData[]> {
  // Create a contextualized logger
  const fetchLogger = logger.withContext({ 
    component: 'FetchProposalsCore', 
    feature: 'proposals' 
  });

  fetchLogger.info("Starting proposal fetch", { 
    userId, 
    userRole, 
    filters 
  });

  // Build and execute the query
  const query = buildBaseProposalsQuery(supabase, userRole, userId, filters);
  const { data: proposalsData, error } = await query;

  if (error) {
    fetchLogger.error("Supabase query error", { error });
    throw error;
  }

  if (!proposalsData) {
    fetchLogger.warn("No proposals data returned");
    return [];
  }

  fetchLogger.info("Raw proposals fetched", { count: proposalsData.length });
  
  // Transform ProposalRow[] to RawProposalData[]
  return (proposalsData as any[]).map((proposal: any) => {
    const onboarding = Array.isArray(proposal.project_onboarding) && proposal.project_onboarding.length > 0
      ? proposal.project_onboarding[0]
      : null;

    return {
      id: proposal.id,
      title: proposal.title || 'Untitled Proposal',
      status: proposal.status || 'draft',
      created_at: proposal.created_at,
      signed_at: proposal.signed_at,
      archived_at: proposal.archived_at,
      deleted_at: proposal.deleted_at,
      review_later_until: proposal.review_later_until,
      client_id: proposal.client_id,
      client_reference_id: proposal.client_reference_id,
      agent_id: proposal.agent_id,
      // Only the clientInfo/projectInfo branches of the stored content are used by
      // list screens, so the query fetches just those instead of the full payload.
      content: proposal.content ?? {
        clientInfo: proposal.clientInfo ?? undefined,
        projectInfo: proposal.projectInfo ?? undefined,
      },
      annual_energy: proposal.annual_energy,
      carbon_credits: proposal.carbon_credits,
      client_share_percentage: proposal.client_share_percentage,
      agent_commission_percentage: proposal.agent_commission_percentage,
      system_size_kwp: proposal.system_size_kwp,
      unit_standard: proposal.unit_standard,
      invitation_sent_at: proposal.invitation_sent_at,
      invitation_viewed_at: proposal.invitation_viewed_at,
      invitation_expires_at: proposal.invitation_expires_at,
      last_email_event_type: proposal.last_email_event_type,
      last_email_sent_at: proposal.last_email_sent_at,
      engagement_count: proposal.engagement_count,
      last_engagement_at: proposal.last_engagement_at,
      onboarding_complete: onboarding?.onboarding_complete || false,
      submitted_for_review: onboarding?.submitted_for_review || false,
      admin_validated: onboarding?.admin_validated || false,
      audit_ready: onboarding?.audit_ready || false,
    };
  });
}
