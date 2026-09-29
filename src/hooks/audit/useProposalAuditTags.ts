import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { AuditTag } from '@/services/calculations/carbon/auditPeriods';

/**
 * Audit rounds a proposal's onboarding project belongs to.
 *
 * Proposals that have not reached onboarding (all new proposals) have no tags,
 * so their generation starts at the Audit 3 cutoff of 1 July 2026.
 */
export function useProposalAuditTags(proposalId?: string | null) {
  const { data } = useQuery({
    queryKey: ['proposal-audit-tags', proposalId],
    enabled: !!proposalId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<AuditTag[]> => {
      const { data, error } = await supabase
        .from('project_onboarding')
        .select('audit_tags')
        .eq('proposal_id', proposalId!)
        .maybeSingle();

      if (error) throw error;
      return ((data?.audit_tags || []) as AuditTag[]).slice().sort();
    },
  });

  return data ?? [];
}
