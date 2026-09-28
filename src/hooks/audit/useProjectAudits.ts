import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/auth";

export const AUDIT_TAGS = ["Audit 1", "Audit 2", "Audit 3"] as const;
export type AuditTag = (typeof AUDIT_TAGS)[number];

export interface AuditProject {
  onboardingId: string;
  projectName: string;
  clientName: string;
  sizeKwp: number;
  auditReady: boolean;
  auditTag: AuditTag | null;
}

const KEY = ["portfolio-audit-projects"];

/** Onboarding projects visible to the viewer (row-level access rules scope them). */
export function usePortfolioAuditProjects() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...KEY, user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<AuditProject[]> => {
      const { data, error } = await (supabase.from("project_onboarding") as any)
        .select(
          `id, audit_ready, audit_tag,
           proposals!inner(title, system_size_kwp, deleted_at, archived_at,
             clients:client_reference_id(first_name, last_name, company_name))`,
        )
        .is("proposals.deleted_at", null)
        .is("proposals.archived_at", null);
      if (error) throw error;
      return (data || []).map((r: any) => {
        const p = Array.isArray(r.proposals) ? r.proposals[0] : r.proposals;
        const c = p?.clients;
        const person = [c?.first_name, c?.last_name].filter(Boolean).join(" ");
        return {
          onboardingId: r.id,
          projectName: p?.title || "Untitled project",
          clientName: c?.company_name || person || "—",
          sizeKwp: Number(p?.system_size_kwp) || 0,
          auditReady: r.audit_ready === true,
          auditTag: r.audit_tag ?? null,
        };
      });
    },
  });
}

/** Admin-only: the server re-checks the admin role and audit readiness. */
export function useSetProjectAuditTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ onboardingId, tag }: { onboardingId: string; tag: AuditTag | null }) => {
      const { error } = await (supabase.rpc as any)("set_project_audit_tag", {
        p_onboarding_id: onboardingId,
        p_audit_tag: tag ?? "",
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
