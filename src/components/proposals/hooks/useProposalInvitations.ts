
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth";
import { logManualAgentContact } from "@/services/proposals/agentContactLogger";
import { isEmailSuppressed } from "@/services/proposals/emailSuppressionService";
import { ClientInformation, ProjectInformation } from "../types";
import { logger } from '@/lib/logger';

interface ProposalContent {
  clientInfo?: ClientInformation;
  projectInfo?: ProjectInformation;
}

interface InvitationResponse {
  success: boolean;
  error?: string;
  details?: string;
  data?: any;
  debug?: {
    tokenUsed?: string;
    proposalId?: string;
    invitationLink?: string;
  };
}

export function useProposalInvitations(onProposalUpdate?: () => void) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [sending, setSending] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSentProposalId, setLastSentProposalId] = useState<string | null>(null);
  
  const handleSendInvitation = async (id: string) => {
    try {
      setSending(true);
      setError(null);
      
      logger.info("Starting invitation process for proposal", { proposalId: id });
      
      // First verify the proposal is in the correct status - include client_reference_id for live lookup
      let { data: proposalData, error: proposalError } = await supabase
        .from('proposals')
        .select('status, content, client_id, client_reference_id, invitation_token')
        .eq('id', id)
        .single();
      
      if (proposalError) {
        logger.error("Error fetching proposal data", { error: proposalError });
        return { success: false, error: proposalError.message };
      }
      
      // Handle stale proposals - revive them by regenerating token and resetting to draft
      // When the email is sent, status will change to 'sent'
      if (proposalData.status === 'stale') {
        logger.info(`Reviving stale proposal ${id} - generating new token and resetting to draft`);
        
        // Fetch validity period from system_settings
        const { data: timingData } = await supabase
          .from('system_settings')
          .select('setting_value')
          .eq('setting_key', 'email_automation_timing')
          .single();

        const validityHours = (timingData?.setting_value as any)?.proposal_validity_hours || 240;
        
        // Generate new token and set new expiration date
        const expirationDate = new Date();
        expirationDate.setHours(expirationDate.getHours() + validityHours);
        
        const { data: newToken, error: tokenError } = await supabase.rpc('generate_secure_token');
        
        if (tokenError) {
          logger.error("Token generation error for stale revival", { error: tokenError });
          return { success: false, error: tokenError.message };
        }
        
        // Update the proposal with new token, expiration, and reset status to draft
        // The send-proposal-invitation edge function will change status to 'sent'
        const { error: updateError } = await supabase
          .from('proposals')
          .update({
            status: 'draft',
            invitation_token: newToken,
            invitation_expires_at: expirationDate.toISOString(),
            invitation_viewed_at: null,
            invitation_sent_at: null
          })
          .eq('id', id);
        
        if (updateError) {
          const errorMsg = `Failed to revive stale proposal: ${updateError.message}`;
          logger.error(errorMsg);
          return { success: false, error: errorMsg };
        }
        
        // Refresh proposal data after revival
        const { data: revivedData, error: refetchError } = await supabase
          .from('proposals')
          .select('status, content, client_id, client_reference_id, invitation_token')
          .eq('id', id)
          .single();
          
        if (refetchError || !revivedData) {
          const errorMsg = `Failed to refetch proposal after revival: ${refetchError?.message}`;
          logger.error(errorMsg);
          return { success: false, error: errorMsg };
        }
        
        proposalData = revivedData;
        logger.info(`Stale proposal revived with new token, status now: ${proposalData.status}`);
      }
      
      // Draft proposals are allowed - they stay as draft until email is successfully sent
      // The send-proposal-invitation edge function will change status to 'sent'
      // No longer auto-promoting to 'pending' - that status is removed
      
      // Bounced proposals remain actionable so a corrected or temporary address can be retried.
      // Removed 'pending' - proposals go draft → sent when email is dispatched
      const allowedStatuses = ['draft', 'sent', 'stale', 'delivered', 'opened', 'viewed', 'bounced'];
      if (!allowedStatuses.includes(proposalData.status)) {
        const errorMsg = `This proposal cannot be emailed in its current status: ${proposalData.status}`;
        logger.error(errorMsg);
        return { success: false, error: errorMsg };
      }
      
      // Option A: Always generate a fresh token for security (invalidates old links)
      logger.debug("Generating fresh token for invitation (Option A - always new token)");
      
      // Fetch validity period from system_settings
      const { data: timingData } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'email_automation_timing')
        .single();

      const validityHours = (timingData?.setting_value as any)?.proposal_validity_hours || 240;
      
      // Generate fresh token and set new expiration date
      const expirationDate = new Date();
      expirationDate.setHours(expirationDate.getHours() + validityHours);
      
      const { data: token, error: tokenError } = await supabase.rpc('generate_secure_token');
      
      if (tokenError) {
        logger.error("Token generation error", { error: tokenError });
        return { success: false, error: tokenError.message };
      }
      
      const tokenToUse = token;
      logger.debug("New secure token generated", { tokenPrefix: token.substring(0, 8) });
      
      // Update the proposal with new token and fresh expiration (invalidates old links)
      const { error: updateError } = await supabase
        .from('proposals')
        .update({
          invitation_token: tokenToUse,
          invitation_expires_at: expirationDate.toISOString(),
          invitation_viewed_at: null // Reset view tracking
        })
        .eq('id', id);
      
      if (updateError) {
        logger.error("Error updating proposal with token", { error: updateError });
        return { success: false, error: updateError.message };
      }
      
      logger.debug("Proposal updated with fresh token and expiration");
      
      // Extract client info from proposal content
      const content = proposalData.content as ProposalContent;
      const clientInfo = content?.clientInfo;
      const clientId = proposalData.client_id;
      const clientReferenceId = proposalData.client_reference_id;
      
      // Prioritize live client data over snapshot for email sending
      let resolvedEmail = clientInfo?.email;
      let resolvedName = clientInfo?.name || 'Client';
      
      if (clientReferenceId) {
        const { data: liveClient } = await supabase
          .from('clients')
          .select('email, first_name, last_name')
          .eq('id', clientReferenceId)
          .single();
        
        if (liveClient?.email) {
          logger.info("Using live client email instead of snapshot", {
            snapshotEmail: clientInfo?.email,
            liveEmail: liveClient.email
          });
          resolvedEmail = liveClient.email;
          resolvedName = `${liveClient.first_name || ''} ${liveClient.last_name || ''}`.trim() || resolvedName;
        }
      }
      
      logger.debug("Proposal data retrieved", { 
        hasClientInfo: !!clientInfo?.email,
        hasClientId: !!clientId,
        hasClientReferenceId: !!clientReferenceId,
        resolvedEmail,
        tokenLength: tokenToUse.length
      });
      
      if (!resolvedEmail) {
        return { success: false, error: "No client email found in the proposal" };
      }

      // Block list check
      if (await isEmailSuppressed(resolvedEmail)) {
        const msg = `${resolvedEmail} has a permanent delivery block. Update the client email, or ask an admin to review Blocked Emails.`;
        toast({ title: "Email blocked", description: msg, variant: "destructive" });
        return { success: false, error: msg };
      }
      
      logger.info("Calling email function", { tokenPrefix: tokenToUse.substring(0, 8) });
      
      // Call the edge function to send email with timeout handling
      const invokeStartTime = Date.now();
      const response = await supabase.functions.invoke('send-proposal-invitation', {
        body: JSON.stringify({
          proposalId: id,
          clientEmail: resolvedEmail,
          clientName: resolvedName,
          invitationToken: tokenToUse,
          projectName: content?.projectInfo?.name || 'Carbon Credit Project',
          clientId: clientId
        })
      });
      const invokeDuration = Date.now() - invokeStartTime;
      
      logger.info("Edge function responded", { duration: invokeDuration });
      
      // Check for network/invocation errors first
      if (response.error) {
        const errorDetails = {
          message: response.error.message,
          status: (response.error as any).status,
          code: (response.error as any).code
        };
        
        logger.error("Edge function invocation failed", {
          error: errorDetails,
          duration: invokeDuration
        });

        // Check for authentication errors specifically
        if (errorDetails.status === 401 || errorDetails.code === 'AUTH_REQUIRED' || errorDetails.code === 'AUTH_EXPIRED') {
          return { 
            success: false, 
            error: 'Your session has expired. Please refresh the page and try again.'
          };
        }
        
        // Revert token on failure (we always generate fresh tokens now)
        await supabase
          .from('proposals')
          .update({
            invitation_token: null,
            invitation_expires_at: null
          })
          .eq('id', id);
        
        return { 
          success: false, 
          error: `Network error: ${response.error.message || 'Edge function invocation failed'}`
        };
      }
      
      // Parse the response
      const emailResponse = response.data as InvitationResponse;
      logger.info("Email function response", {
        success: emailResponse?.success,
        hasError: !!emailResponse?.error,
        debug: emailResponse?.debug,
        duration: invokeDuration
      });
      
      if (!emailResponse?.success) {
        const errorMessage = emailResponse?.details || emailResponse?.error || "Email service error";
        logger.error("Email sending failed", {
          error: errorMessage,
          duration: invokeDuration
        });
        
        // Revert token on failure (we always generate fresh tokens now)
        await supabase
          .from('proposals')
          .update({
            invitation_token: null,
            invitation_expires_at: null
          })
          .eq('id', id);
          
        return { success: false, error: errorMessage };
      }
      
      // ✅ EMAIL SENT SUCCESSFULLY - NOW update invitation_sent_at
      logger.info("Email confirmed sent, updating database");
      const { error: sentUpdateError } = await supabase
        .from('proposals')
        .update({
          invitation_sent_at: new Date().toISOString()
        })
        .eq('id', id);
      
      if (sentUpdateError) {
        logger.warn("Email sent but failed to update sent timestamp", { error: sentUpdateError });
        // Don't fail the whole operation since email was actually sent
      }

      // Log manual agent contact for learning metrics
      if (user?.id) {
        await logManualAgentContact({
          proposalId: id,
          userId: user.id,
          triggerEvent: "send_invitation",
          details: { method: "email", action: "agent_initiated_send" },
        });
      }
      
      logger.info("Invitation sent successfully", { debug: emailResponse.debug });
      
      // Set the last sent proposal ID for testing reference
      setLastSentProposalId(id);
      
      // Refresh the proposal list
      if (onProposalUpdate) {
        onProposalUpdate();
      }
      
      return { 
        success: true, 
        proposalId: id, 
        token: tokenToUse,
        debug: emailResponse.debug
      };
    } catch (error: any) {
      logger.error("Error sending invitation", { error });
      
      const errorMessage = error instanceof Error ? error.message : "Failed to send invitation";
      setError(errorMessage);
      
      return { success: false, error: errorMessage };
    } finally {
      setSending(false);
    }
  };
  
  const handleResendInvitation = async (id: string) => {
    return await handleSendInvitation(id);
  };
  
  return {
    handleSendInvitation,
    handleResendInvitation,
    sending,
    error,
    lastSentProposalId
  };
}
