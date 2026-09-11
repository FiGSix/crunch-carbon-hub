
import { useState } from "react";
import { Mail, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Proposal } from "../types";
import { useProposalInvitations } from "../hooks/useProposalInvitations";
import { useAuth } from "@/contexts/auth";
import { useToast } from "@/hooks/use-toast";
import { devLogger } from '@/lib/performance/ConsoleReplacementUtility';

interface ProposalInviteButtonProps {
  proposal: Proposal;
  onProposalUpdate?: () => void;
}

export function ProposalInviteButton({ proposal, onProposalUpdate }: ProposalInviteButtonProps) {
  const { handleSendInvitation, handleResendInvitation, sending } = useProposalInvitations(onProposalUpdate);
  const { userRole } = useAuth();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Only agents and admins can send invitations
  if (userRole !== "agent" && userRole !== "admin") {
    return null;
  }

  const handleInvite = async () => {
    setIsProcessing(true);
    try {
      console.log("Sending invitation for proposal", { 
        proposalId: proposal.id, 
        status: proposal.status
      });
      
      // For draft or pending proposals that haven't been sent yet
      const result = await handleSendInvitation(proposal.id);
      
      if (result.success) {
        toast({
          title: "Invitation Sent",
          description: "Invitation has been sent to the client successfully.",
        });
        
        // Trigger parent component's update function if provided
        if (onProposalUpdate) {
          onProposalUpdate();
        }
      } else {
        devLogger.proposals.error("Invitation failed", result.error);
        toast({
          title: "Invitation Failed",
          description: result.error || "There was an error sending the invitation. Please try again.",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      devLogger.proposals.error("Error in invitation process", error);
      toast({
        title: "Invitation Error",
        description: error.message || "An unexpected error occurred while sending the invitation.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResend = async () => {
    setIsProcessing(true);
    try {
      console.log("Resending invitation for proposal", { 
        proposalId: proposal.id
      });
      
      // For pending proposals that have been sent but not viewed
      const result = await handleResendInvitation(proposal.id);
      
      if (result.success) {
        toast({
          title: "Invitation Resent",
          description: "Invitation has been resent to the client successfully.",
        });
        
        // Trigger parent component's update function if provided
        if (onProposalUpdate) {
          onProposalUpdate();
        }
      } else {
        devLogger.proposals.error("Resend failed", result.error);
        toast({
          title: "Resend Failed",
          description: result.error || "There was an error resending the invitation. Please try again.",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      devLogger.proposals.error("Error in resend process", error);
      toast({
        title: "Resend Error",
        description: error.message || "An unexpected error occurred while resending the invitation.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };
  
  // For draft proposals that haven't been sent yet (pending was removed from status lifecycle)
  if (proposal.status === "draft" && !proposal.invitation_sent_at) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={handleInvite}
        className="text-carbon-blue-600"
        disabled={isProcessing || sending}
      >
        {isProcessing || sending ? (
          <>
            <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Sending...
          </>
        ) : (
          <>
            Send Invitation <Mail className="h-4 w-4 ml-1" />
          </>
        )}
      </Button>
    );
  }
  
  // For sent/delivered/opened proposals that have been sent but not viewed
  if ((proposal.status === "sent" || proposal.status === "delivered" || proposal.status === "opened") && proposal.invitation_sent_at && !proposal.invitation_viewed_at) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={handleResend}
        className="text-carbon-blue-600"
        disabled={isProcessing || sending}
      >
        {isProcessing || sending ? (
          <>
            <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Sending...
          </>
        ) : (
          <>
            Resend <Mail className="h-4 w-4 ml-1" />
          </>
        )}
      </Button>
    );
  }
  
  // For proposals that have been viewed, allow resending
  if ((proposal.status === "sent" || proposal.status === "delivered" || proposal.status === "viewed") && proposal.invitation_viewed_at) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={handleResend}
        className="text-carbon-blue-600"
        disabled={isProcessing || sending}
      >
        {isProcessing || sending ? (
          <>
            <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Sending...
          </>
        ) : (
          <>
            Send Again <Mail className="h-4 w-4 ml-1" />
          </>
        )}
      </Button>
    );
  }
  
  // For stale proposals - allow revival with new invitation
  if (proposal.status === "stale") {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={handleResend}
        className="text-carbon-blue-600"
        disabled={isProcessing || sending}
      >
        {isProcessing || sending ? (
          <>
            <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Sending...
          </>
        ) : (
          <>
            Revive & Send <Mail className="h-4 w-4 ml-1" />
          </>
        )}
      </Button>
    );
  }

  // Keep recovery visible after a delivery failure. The send flow resolves the
  // latest linked client email and explains permanent blocks instead of hiding.
  if (proposal.status === "bounced") {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={handleResend}
        className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
        disabled={isProcessing || sending}
      >
        {isProcessing || sending ? (
          <>
            <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Retrying...
          </>
        ) : (
          <>
            Retry email <RotateCcw className="h-4 w-4 ml-1" />
          </>
        )}
      </Button>
    );
  }
  
  // Don't show for other statuses (signed, rejected, etc.)
  return null;
}
