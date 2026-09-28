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
  auditTags: AuditTag[];
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
          `id, audit_ready, audit_tags,
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
          auditTags: ((r.audit_tags || []) as AuditTag[]).slice().sort(),
        };
      });
    },
  });
}

/** First audit a project joined, or null. */
export const firstAudit = (p: AuditProject): AuditTag | null =>
  AUDIT_TAGS.find((t) => p.auditTags.includes(t)) ?? null;

/** Admin-only: the server re-checks the admin role and audit readiness. */
export function useSetProjectAuditTags() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ onboardingId, tags }: { onboardingId: string; tags: AuditTag[] }) => {
      const { error } = await (supabase.rpc as any)("set_project_audit_tags", {
        p_onboarding_id: onboardingId,
        p_tags: tags,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

/** Admin-only: add every Audit Ready project in `from` to `to`. Returns count added. */
export function useCarryForwardAudit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ from, to }: { from: AuditTag; to: AuditTag }): Promise<number> => {
      const { data, error } = await (supabase.rpc as any)("carry_forward_audit", { p_from: from, p_to: to });
      if (error) throw error;
      return Number(data) || 0;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
