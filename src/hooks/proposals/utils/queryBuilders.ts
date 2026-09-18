
import { SupabaseClient } from '@supabase/supabase-js';
import { ProposalFilters } from '../types';

/**
 * Build the base query for fetching proposals
 */
export function buildBaseProposalsQuery(
  supabase: SupabaseClient,
  userRole: string | null,
  userId: string | null,
  filters: ProposalFilters
) {
  let query = supabase
    .from('proposals')
    .select(`
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
      agent_commission_percentage,
      system_size_kwp,
      unit_standard,
      invitation_sent_at,
      invitation_viewed_at,
      invitation_expires_at,
      last_email_event_type,
      last_email_sent_at,
      engagement_count,
      last_engagement_at,
      project_onboarding (
        onboarding_complete,
        submitted_for_review,
        admin_validated,
        audit_ready
      )
    `)
    .is('deleted_at', null); // Exclude soft-deleted proposals

  // Apply role-based filtering
  // For clients: RLS policy handles access via is_proposal_client() function
  // which properly checks both client_id and client_reference_id linkage
  // No additional client-side filtering needed - database enforces proper visibility
  // Agent and admin roles: RLS policy handles access control (including company membership)

  // Apply status filter
  if (filters.status && filters.status !== 'all') {
    if (filters.status === 'archived') {
      query = query.not('archived_at', 'is', null);
    } else if (filters.status === 'review-later') {
      query = query
        .not('review_later_until', 'is', null)
        .gte('review_later_until', new Date().toISOString());
    } else {
      query = query.eq('status', filters.status);
    }
  }

  // NOTE: Search filter is now applied client-side for instant performance
  // Server-side filtering was causing slow queries on every keystroke

  // Apply sorting
  if (filters.sort === 'oldest') {
    query = query.order('created_at', { ascending: true });
  } else if (filters.sort === 'title') {
    query = query.order('title', { ascending: true });
  } else if (filters.sort === 'status') {
    query = query.order('status', { ascending: true });
  } else {
    // Default to newest first
    query = query.order('created_at', { ascending: false });
  }

  // Lift Supabase's default 1000-row cap so older active proposals are not
  // silently dropped from the client-side search. The list is rendered with
  // virtualization + client-side filtering, so 5000 is safe today.
  // TODO: replace with proper server-side pagination once active proposals
  // routinely exceed a few thousand rows.
  query = query.range(0, 4999);

  return query;
}
