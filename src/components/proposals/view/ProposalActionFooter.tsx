
import { useState } from "react";
import { X, CheckCircle2, Loader2, AlertTriangle } from "lucide-react";
import { CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ApprovalSignatureDialog } from "./ApprovalSignatureDialog";
import { logger } from "@/lib/logger";

interface ProposalActionFooterProps {
  onApprove: (typedName: string) => Promise<void>;
  onReject: () => Promise<void>;
  showActions: boolean;
  clientName: string;
  proposalTitle: string;
  isClient?: boolean;
  accessedViaToken?: boolean;
  token?: string | null;
  proposalId?: string;
}

export function ProposalActionFooter({ 
  onApprove, 
  onReject,
  showActions,
  clientName,
  proposalTitle,
  isClient = false,
  accessedViaToken = false,
  token = null,
  proposalId
}: ProposalActionFooterProps) {
  const navigate = useNavigate();
  const [showSignatureDialog, setShowSignatureDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  if (!showActions) {
    return null;
  }
  
  const handleApproveClick = () => {
    // If user is a client, always navigate to accept page
    if (isClient && proposalId) {
      const acceptUrl = token 
        ? `/proposals/${proposalId}/accept?token=${token}`
        : `/proposals/${proposalId}/accept`;
      navigate(acceptUrl);
    } else {
      // Show signature dialog for non-clients (e.g., agents)
      setShowSignatureDialog(true);
    }
  };
  
  const handleApprove = async (typedName: string) => {
    try {
      setErrorMessage(null);
      logger.info("Starting proposal approval with signature", { typedName });
      await onApprove(typedName);
      logger.info("Proposal approval completed successfully");
      setShowSignatureDialog(false);
    } catch (error) {
      logger.error("Error during proposal approval:", error);
      setErrorMessage("Failed to approve the proposal. Please try again.");
      throw error;
    }
  };
  
  const handleReject = async () => {
    try {
      setErrorMessage(null);
      setIsRejecting(true);
      logger.info("Starting proposal rejection process");
      await onReject();
      logger.info("Proposal rejection completed successfully");
    } catch (error) {
      logger.error("Error during proposal rejection:", error);
      setErrorMessage("Failed to reject the proposal. Please try again.");
    } finally {
      setIsRejecting(false);
      setShowRejectDialog(false);
    }
  };
  
  return (
    <>
      {errorMessage && (
        <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md flex items-center gap-2 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
      
      <CardFooter className="flex flex-col sm:flex-row gap-4 justify-between border-t pt-6">
        <Button 
          variant="destructive" 
          className="w-full sm:w-auto order-2 sm:order-1"
          onClick={() => setShowRejectDialog(true)}
          disabled={isRejecting}
        >
          <X className="mr-2 h-4 w-4" /> Decline Proposal
        </Button>
        <Button 
          variant="default" 
          className="w-full sm:w-auto bg-green-600 hover:bg-green-700 order-1 sm:order-2"
          onClick={handleApproveClick}
          disabled={isRejecting}
        >
          <CheckCircle2 className="mr-2 h-4 w-4" /> 
          {accessedViaToken ? "Accept Proposal" : "Approve Proposal"}
        </Button>
      </CardFooter>
      
      {/* Signature Dialog for Approval */}
      <ApprovalSignatureDialog
        open={showSignatureDialog}
        onOpenChange={setShowSignatureDialog}
        onConfirm={handleApprove}
        clientName={clientName}
        proposalTitle={proposalTitle}
      />
      
      {/* Reject Confirmation Dialog */}
      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Decline Proposal</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to decline this proposal? If you have any questions or would like to discuss modifications, please contact the agent directly.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-col-reverse sm:flex-row gap-2">
            <AlertDialogCancel disabled={isRejecting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleReject}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isRejecting}
            >
              {isRejecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 
                  Processing...
                </>
              ) : (
                "Yes, Decline"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
