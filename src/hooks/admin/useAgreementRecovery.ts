import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type RecoveryState =
  | "not_started"
  | "fixed"
  | "link_sent"
  | "opened"
  | "signed"
  | "bounced"
  | "failed"
  | "handled"
  | "resolved";

export interface RecoveryItem {
  id: string;
  client_id: string;
  client_name: string | null;
  client_email: string | null;
  group_code: "A" | "B" | "C";
  a_count: number;
  b_count: number;
  c_count: number;
  project_count: number;
  total_count: number;
  proposal_ids: string[];
  state: RecoveryState;
  link_proposal_id: string | null;
  link_token: string | null;
  link_expires_at: string | null;
  last_action: string | null;
  last_action_at: string | null;
  note: string | null;
  resolved_at: string | null;
}

const KEY = ["agreement-recovery-items"];

export function useAgreementRecoveryItems() {
  return useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<RecoveryItem[]> => {
      const { data, error } = await supabase
        .from("agreement_recovery_items")
        .select("*")
        .order("group_code", { ascending: true })
        .order("project_count", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as RecoveryItem[];
    },
    staleTime: 30_000,
  });
}

export function useRefreshAgreementRecovery() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("refresh_agreement_recovery");
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEY });
      toast.success("List rebuilt from the latest records");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export type RecoveryAction = "fix_documents" | "issue_link" | "mark_handled";

export function useAgreementRecoveryAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      action: RecoveryAction;
      itemIds: string[];
      sendEmail?: boolean;
      note?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke(
        "agreement-recovery-action",
        { body: payload },
      );
      if (error) throw error;
      if ((data as { error?: string })?.error) {
        throw new Error((data as { error: string }).error);
      }
      return data as {
        results: Array<{
          itemId: string;
          ok: boolean;
          link?: string;
          error?: string;
          skipReason?: string;
        }>;
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: KEY });
      const failed = data.results.filter((r) => !r.ok);
      if (failed.length === 0) {
        toast.success(`Done for ${data.results.length} client(s)`);
      } else {
        toast.warning(
          `${data.results.length - failed.length} succeeded, ${failed.length} need attention`,
        );
      }
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
