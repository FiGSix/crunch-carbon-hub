import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { logger } from "@/lib/logger";
import { useToast } from "@/hooks/use-toast";

export function useReactivateProposal() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (proposalId: string) => {
      const { error } = await supabase
        .from("proposals")
        .update({ archived_at: null })
        .eq("id", proposalId);
      if (error) {
        logger.error("Failed to reactivate proposal", error);
        throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: "Proposal reactivated",
        description: "Back in your active pipeline.",
      });
      qc.invalidateQueries({ queryKey: ["proposals"] });
    },
    onError: (e: any) =>
      toast({
        title: "Couldn't reactivate",
        description: e?.message ?? "Unknown error",
        variant: "destructive",
      }),
  });
}
