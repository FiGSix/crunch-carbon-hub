
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase/client";
import { createNotification } from "@/services/notificationService";
import { ProposalOperationResult } from "@/types/proposals";
import { useErrorHandler } from "@/hooks/useErrorHandler";
import { logger } from "@/lib/logger";

/**
 * Hook for deleting proposals
 */
export function useDeleteProposal(setLoadingState: (operation: 'delete', isLoading: boolean) => void) {
  const { toast } = useToast();
  const { handleError } = useErrorHandler({
    context: "proposal-deletion",
    toastOnError: true,
    navigateOnFatal: false
  });
  
  // Create a contextualized logger for this component
  const proposalLogger = logger.withContext({ 
    component: 'DeleteProposal', 
    feature: 'proposals' 
  });
  
  const deleteProposal = async (proposalId: string, userId: string): Promise<ProposalOperationResult> => {
    try {
      proposalLogger.info({ message: `Starting delete process for proposal: ${proposalId}`, proposalId, userId });
      setLoadingState('delete', true);
      
      // Fetch the proposal for notification
      const { data: proposals, error: fetchError } = await supabase
        .from('proposals')
        .select('client_id, agent_id, title')
        .eq('id', proposalId);
        
      if (fetchError) throw fetchError;
      
      if (!proposals || proposals.length === 0) {
        throw new Error("Proposal not found");
      }
      
      const proposal = proposals[0];
      
      // Server identifies the caller from the session; userId is only used for notifications
      const { data, error } = await supabase
        .rpc('delete_proposal', { proposal_id: proposalId });
      
      if (error) throw error;
      
      if (!data) {
        throw new Error("Failed to delete proposal. You may not have permission to delete this proposal.");
      }
      
      proposalLogger.info({ message: "Proposal deleted successfully", proposalId });
      
      // Create notification for the relevant party
      // If agent deleted, notify client; if client deleted, notify agent
      const recipientId = userId === proposal?.client_id ? proposal?.agent_id : proposal?.client_id;
      
      if (recipientId) {
        try {
          await createNotification({
            userId: recipientId,
            title: "Proposal Deleted",
            message: `The proposal "${proposal?.title}" has been deleted.`,
            type: "info",
            relatedId: proposalId,
            relatedType: "proposal"
          });
          proposalLogger.info({ message: "Notification sent to recipient", recipientId });
        } catch (notificationError) {
          // Log but don't block the main operation
          handleError(notificationError, "Failed to send notification", "warning");
        }
      }
      
      toast({
        title: "Proposal Deleted",
        description: "The proposal has been successfully deleted.",
      });
      
      return { success: true };
    } catch (error) {
      const errorState = handleError(error, "Failed to delete proposal");
      return { 
        success: false, 
        error: errorState.message || "Failed to delete proposal" 
      };
    } finally {
      setLoadingState('delete', false);
    }
  };

  return { deleteProposal };
}
