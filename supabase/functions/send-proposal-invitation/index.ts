
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { supabase } from "../_shared/supabase-client.ts";
import { validateInvitationRequest } from "./validation.ts";
import { verifyTokenConsistency } from "./token-verification.ts";
import { EmailService } from "./email-service.ts";
import { createClientNotification } from "./notification-service.ts";
import { 
  corsHeaders,
  createCorsResponse, 
  createSuccessResponse, 
  createEmailErrorResponse, 
  createGeneralErrorResponse 
} from "./responses.ts";
import type { InvitationRequest, EmailTemplateData } from "./types.ts";

const handler = async (req: Request): Promise<Response> => {
  // Entry logging for debugging
  console.log("=== 🚀 SEND-PROPOSAL-INVITATION INVOKED ===");
  console.log("Timestamp:", new Date().toISOString());
  console.log("Method:", req.method);
  console.log("Has Authorization header:", !!req.headers.get('authorization'));
  console.log("==========================================");

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return createCorsResponse();
  }

  try {
    // Log the API key presence (not the actual key) for debugging
    const hasApiKey = !!Deno.env.get("RESEND_API_KEY");
    console.log(`RESEND_API_KEY is ${hasApiKey ? "set" : "not set"}`);
    
    if (!hasApiKey) {
      throw new Error("RESEND_API_KEY is not configured. Please set this environment variable.");
    }

    // Verify authentication (JWT required)
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      console.error("❌ Missing authorization header");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Authentication required. Please refresh your session and try again.",
          code: "AUTH_REQUIRED"
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    // Verify JWT token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error("❌ Invalid or expired JWT token:", authError?.message);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Session expired. Please refresh the page and try again.",
          code: "AUTH_EXPIRED"
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    console.log("✅ Authenticated user:", user.id);
    
    // Parse and validate request
    const requestData = await req.json();
    console.log("Received invitation request data:", JSON.stringify({
      ...requestData,
      invitationToken: requestData.invitationToken ? `${requestData.invitationToken.substring(0, 8)}...` : undefined,
    }));
    
    const validatedRequest: InvitationRequest = validateInvitationRequest(requestData);
    const { 
      proposalId, 
      clientEmail, 
      clientName, 
      invitationToken,
      projectName,
      clientId,
      ccEmails,
      ccNames
    } = validatedRequest;

    if (ccEmails?.length) {
      console.log(`CC'ing ${ccEmails.length} additional client(s): ${ccEmails.join(', ')}`);
    }

    // CRITICAL: Verify the token from the request matches what's stored in the database
    const verifiedToken = await verifyTokenConsistency(proposalId, invitationToken, supabase);
    
    // Fetch agent email and project details for the invitation
    const { data: proposalData } = await supabase
      .from('proposals')
      .select('agent_id, system_size_kwp, carbon_credits, annual_energy, client_share_percentage, content')
      .eq('id', proposalId)
      .single();
    
    let agentEmail: string | undefined;
    let agentFirstName: string | undefined;
    let agentLastName: string | undefined;
    let agentCompanyName: string | undefined;
    
    if (proposalData?.agent_id) {
      const { data: agentProfile } = await supabase
        .from('profiles')
        .select('email, first_name, last_name, company_name')
        .eq('id', proposalData.agent_id)
        .single();
      
      agentEmail = agentProfile?.email;
      agentFirstName = agentProfile?.first_name;
      agentLastName = agentProfile?.last_name;
      agentCompanyName = agentProfile?.company_name;
      
      if (agentEmail) {
        console.log(`Agent will be CC'd: ${agentEmail}`);
      }
    }
    
    // Get site URL from environment variable, with fallback
    const siteUrl = Deno.env.get('SITE_URL') || 'https://crunchcarbon.com';

    // Use the VERIFIED token from the database to construct links.
    // Primary CTA goes straight to the token-authorised signing ceremony.
    const acceptLink = `${siteUrl}/proposals/${proposalId}/accept?token=${verifiedToken}`;
    const declineLink = `${siteUrl}/proposals/${proposalId}/decline?token=${verifiedToken}`;
    const invitationLink = `${siteUrl}/proposals/${proposalId}?token=${verifiedToken}`;

    console.log(`Sending invitation email to ${clientEmail} for project ${projectName}`);
    console.log(`Accept link: ${acceptLink}`);
    console.log(`Using verified token: ${verifiedToken.substring(0, 8)}...`);

    // Initialize email service and send email
    const emailService = new EmailService(Deno.env.get("RESEND_API_KEY")!);

    // Build the "30 seconds" summary from values already stored on the proposal.
    // Nothing is invented: any field without a value is simply omitted.
    const content: any = proposalData?.content || {};
    const clientInfo: any = content.clientInfo || {};
    const projectInfo: any = content.projectInfo || {};

    const systemSizeKwp = proposalData?.system_size_kwp;
    const carbonCredits = proposalData?.carbon_credits;
    const annualEnergy = proposalData?.annual_energy;
    const sharePct = proposalData?.client_share_percentage;
    const totalClientRevenue = content?.financials?.totalClientRevenue;

    const clientRevenueByYear: Record<string, number> | undefined = content?.clientSpecificRevenue;
    const revenueYearCount = clientRevenueByYear
      ? Object.values(clientRevenueByYear).filter((v) => typeof v === 'number' && v > 0).length
      : 0;
    const annualIncome =
      typeof totalClientRevenue === 'number' && totalClientRevenue > 0 && revenueYearCount > 0
        ? Math.round(totalClientRevenue / revenueYearCount)
        : undefined;

    const fmtRand = (n: number) => `R ${Math.round(n).toLocaleString('en-ZA')}`;

    const emailTemplateData: EmailTemplateData = {
      clientName,
      projectName,
      acceptLink,
      declineLink,
      viewLink: invitationLink,
      tokenPreview: verifiedToken.substring(0, 8) + "...",
      proposalId,
      summary: {
        clientOrCompany: clientInfo.companyName || clientInfo.name || clientName || undefined,
        siteLocation: projectInfo.address || undefined,
        capacity: systemSizeKwp ? `${Math.round(systemSizeKwp).toLocaleString('en-ZA')} kWp` : undefined,
        annualGeneration: annualEnergy ? `${Math.round(annualEnergy).toLocaleString('en-ZA')} kWh` : undefined,
        carbonCredits: carbonCredits ? `${Math.round(carbonCredits).toLocaleString('en-ZA')} tCO₂e` : undefined,
        clientSharePercentage: typeof sharePct === 'number' ? sharePct : undefined,
        annualIncome: annualIncome ? fmtRand(annualIncome) : undefined,
        termIncome:
          typeof totalClientRevenue === 'number' && totalClientRevenue > 0
            ? fmtRand(totalClientRevenue)
            : undefined,
        reference: proposalId.substring(0, 8).toUpperCase(),
      },
      agentFirstName,
      agentLastName,
      agentCompanyName,
      agentEmail
    };
    
    const emailTemplate = emailService.generateEmailTemplate(emailTemplateData);
    const emailPlainText = emailService.generatePlainTextTemplate(emailTemplateData);

    try {
      const emailResponse = await emailService.sendInvitationEmail(
        clientEmail,
        projectName,
        emailTemplate,
        agentEmail,
        emailPlainText,
        ccEmails
      );

      // Store the Resend message_id for webhook tracking
      // IMPORTANT: Resend returns { data: { id: "..." }, error: null } structure
      const emailId = emailResponse.data?.id || emailResponse.id;
      
      console.log(`📧 Resend response structure:`, JSON.stringify(emailResponse));
      
      if (emailId) {
        console.log(`📧 Storing message_id for webhook tracking: ${emailId}`);
        
        const { error: logError } = await supabase
          .from('proposal_automation_log')
          .insert({
            proposal_id: proposalId,
            automation_type: 'email_sent',
            email_type: 'initial_invite',
            email_message_id: emailId,
            details: {
              recipient: clientEmail,
              subject: `Carbon Credit Proposal: ${projectName}`,
              agent_email: agentEmail,
              cc: ccEmails?.length ? ccEmails : undefined,
              cc_names: ccNames?.length ? ccNames : undefined
            }
          });

        if (logError) {
          console.error(`❌ Failed to log email to proposal_automation_log:`, logError);
          // Continue anyway - email was sent successfully
        } else {
          console.log(`✅ Successfully logged email to proposal_automation_log`);
        }

        // Update proposal status to 'sent' and track email send time
        const { error: updateError } = await supabase
          .from('proposals')
          .update({
            status: 'sent',
            last_email_event_type: 'email.sent',
            last_email_sent_at: new Date().toISOString(),
            invitation_sent_at: new Date().toISOString()
          })
          .eq('id', proposalId);

        if (updateError) {
          console.error(`❌ Failed to update proposal status:`, updateError);
          // Continue anyway - email was sent successfully
        } else {
          console.log(`✅ Successfully updated proposal ${proposalId} status to 'sent'`);
        }
      } else {
        console.error(`❌ No email ID returned from Resend - cannot track email events. Full response:`, JSON.stringify(emailResponse));
      }

      // Create a notification for the client if we have their ID
      if (clientId) {
        await createClientNotification(clientId, projectName, proposalId, supabase);
      }

      console.log("✅ Invitation email sent successfully:", emailResponse);
      console.log(`✅ Email sent with verified token: ${verifiedToken.substring(0, 8)}...`);

      return createSuccessResponse(emailResponse, {
        tokenUsed: verifiedToken.substring(0, 8) + "...",
        proposalId: proposalId,
        invitationLink: invitationLink
      });
    } catch (emailError: any) {
      return createEmailErrorResponse(emailError);
    }
  } catch (error: any) {
    return createGeneralErrorResponse(error);
  }
};

serve(handler);
