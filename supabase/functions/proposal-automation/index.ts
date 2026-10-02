import "../_shared/sandbox.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Rate limiting utilities
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const RATE_LIMIT_DELAY_MS = 600; // Stay under Resend's 2 req/sec limit

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProposalForAutomation {
  id: string;
  title: string;
  status: string;
  last_email_sent_at: string | null;
  last_engagement_at: string | null;
  last_email_event_type: string | null;
  automation_paused: boolean;
  client_email: string;
  client_name: string;
  agent_id: string;
  agent_email: string;
  invitation_token: string;
}

serve(async (req: Request) => {
  console.log("=== 🤖 PROPOSAL AUTOMATION TRIGGERED ===");
  console.log(`Timestamp: ${new Date().toISOString()}`);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch timing configuration and templates from system_settings
    const { data: timingData, error: timingError } = await supabase
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'email_automation_timing')
      .single();

    const { data: templateData, error: templateError } = await supabase
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'email_automation_templates')
      .single();

    if (timingError || templateError) {
      console.error("❌ Error fetching configuration:", timingError || templateError);
      throw timingError || templateError;
    }

    const timingConfig = timingData.setting_value as any;
    const emailTemplates = templateData.setting_value as any;

    console.log("📝 Using timing config:", timingConfig);

    // Fetch proposals that need automation (including 'clicked' status)
    const { data: proposals, error: fetchError } = await supabase
      .from('proposals')
      .select(`
        id, title, status,
        last_email_sent_at, last_engagement_at, last_email_event_type,
        automation_paused,
        invitation_token,
        agent_id,
        content
      `)
      .eq('automation_paused', false)
      .in('status', ['sent', 'delivered', 'opened', 'clicked'])
      .is('deleted_at', null)
      .is('archived_at', null);

    if (fetchError) {
      console.error("❌ Error fetching proposals:", fetchError);
      throw fetchError;
    }

    console.log(`📋 Found ${proposals?.length || 0} proposals to evaluate`);

    const now = new Date();
    const actions = {
      reminders_sent: 0,
      followups_sent: 0,
      marked_stale: 0,
      errors: 0,
      emails_sent: 0
    };

    for (const proposal of proposals || []) {
      try {
        const clientInfo = proposal.content?.clientInfo || {};
        const clientEmail = clientInfo.email;
        const clientName = clientInfo.name || 'Client';
        
        if (!clientEmail) {
          console.log(`⚠️ Skipping proposal ${proposal.id} - no client email`);
          continue;
        }

        // Get agent email
        const { data: agentProfile } = await supabase
          .from('profiles')
          .select('email')
          .eq('id', proposal.agent_id)
          .single();

        const agentEmail = agentProfile?.email || 'support@crunchcarbon.com';

        const lastSent = proposal.last_email_sent_at ? new Date(proposal.last_email_sent_at) : null;
        const lastEngagement = proposal.last_engagement_at ? new Date(proposal.last_engagement_at) : null;
        
        const daysSinceLastSent = lastSent ? Math.floor((now.getTime() - lastSent.getTime()) / (1000 * 60 * 60 * 24)) : 999;
        const daysSinceLastEngagement = lastEngagement ? Math.floor((now.getTime() - lastEngagement.getTime()) / (1000 * 60 * 60 * 24)) : 999;

        // Check if we already sent a follow-up recently (within 2 days)
        const { data: recentLog } = await supabase
          .from('proposal_automation_log')
          .select('created_at')
          .eq('proposal_id', proposal.id)
          .eq('automation_type', 'follow_up_email')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        const daysSinceLastFollowup = recentLog?.created_at 
          ? Math.floor((now.getTime() - new Date(recentLog.created_at).getTime()) / (1000 * 60 * 60 * 24))
          : 999;

        // Rule 1: Send graceful exit email before marking as stale
        const staleDays = timingConfig.mark_stale_days || 10;
        if (daysSinceLastSent >= staleDays && daysSinceLastEngagement >= staleDays) {
          // Check if we already sent the graceful exit email
          const { data: exitEmailLog } = await supabase
            .from('proposal_automation_log')
            .select('id')
            .eq('proposal_id', proposal.id)
            .eq('email_type', 'graceful_exit')
            .single();
          
          if (!exitEmailLog) {
            console.log(`👋 Sending graceful exit email for proposal ${proposal.id}`);
            
            await sendFollowUpEmail(
              proposal.id,
              'graceful_exit',
              emailTemplates
            );
            actions.emails_sent++;
            
            // Rate limit delay after sending email
            await sleep(RATE_LIMIT_DELAY_MS);

            // Log the automation action with error handling
            const { error: logError1 } = await supabase
              .from('proposal_automation_log')
              .insert({
                proposal_id: proposal.id,
                automation_type: 'follow_up_email',
                trigger_event: 'graceful_exit_before_stale',
                email_type: 'graceful_exit',
                old_status: proposal.status,
                new_status: 'stale'
              });

            if (logError1) {
              console.error(`❌ Error logging automation for proposal ${proposal.id}:`, logError1);
            } else {
              console.log(`✅ Logged graceful_exit automation for proposal ${proposal.id}`);
            }

            // Then mark as stale
            await supabase.rpc('update_proposal_status_with_log', {
              proposal_id: proposal.id,
              new_status: 'stale',
              trigger_event: `auto_stale_after_${staleDays}_days_with_exit_email`,
              is_automated: true
            });

            await supabase
              .from('proposals')
              .update({ last_email_sent_at: now.toISOString() })
              .eq('id', proposal.id);

            actions.marked_stale++;
          }
          continue;
        }

        // Rule 2: Send follow-up for clicked but not signed
        const clickedNotSignedInitial = timingConfig.clicked_not_signed_days || 6;
        const clickedNotSignedRepeat = timingConfig.clicked_not_signed_repeat_days || 6;
        if (proposal.status === 'clicked' && daysSinceLastSent >= clickedNotSignedInitial && daysSinceLastFollowup >= clickedNotSignedRepeat) {
          console.log(`📧 Sending follow-up for clicked proposal ${proposal.id}`);
          
          await sendFollowUpEmail(
            proposal.id,
            'clicked_not_signed',
            emailTemplates
          );
          actions.emails_sent++;
          
          // Rate limit delay after sending email
          await sleep(RATE_LIMIT_DELAY_MS);

          // Log the automation action with error handling
          const { error: logError2 } = await supabase
            .from('proposal_automation_log')
            .insert({
              proposal_id: proposal.id,
              automation_type: 'follow_up_email',
              trigger_event: 'clicked_not_signed_6_days',
              email_type: 'clicked_not_signed',
              old_status: proposal.status,
              new_status: proposal.status
            });

          if (logError2) {
            console.error(`❌ Error logging automation for proposal ${proposal.id}:`, logError2);
          } else {
            console.log(`✅ Logged clicked_not_signed automation for proposal ${proposal.id}`);
          }

          await supabase
            .from('proposals')
            .update({ last_email_sent_at: now.toISOString() })
            .eq('id', proposal.id);

          actions.followups_sent++;
          continue;
        }

        // Rule 3: Send follow-up for opened but not clicked
        const openedNotClickedInitial = timingConfig.opened_not_clicked_days || 4;
        const openedNotClickedRepeat = timingConfig.opened_not_clicked_repeat_days || 4;
        if (proposal.status === 'opened' && daysSinceLastSent >= openedNotClickedInitial && daysSinceLastFollowup >= openedNotClickedRepeat) {
          console.log(`📧 Sending follow-up for opened proposal ${proposal.id}`);
          
          await sendFollowUpEmail(
            proposal.id,
            'opened_not_clicked',
            emailTemplates
          );
          actions.emails_sent++;
          
          // Rate limit delay after sending email
          await sleep(RATE_LIMIT_DELAY_MS);

          // Log the automation action with error handling
          const { error: logError3 } = await supabase
            .from('proposal_automation_log')
            .insert({
              proposal_id: proposal.id,
              automation_type: 'follow_up_email',
              trigger_event: 'opened_not_clicked_4_days',
              email_type: 'opened_not_clicked',
              old_status: proposal.status,
              new_status: proposal.status
            });

          if (logError3) {
            console.error(`❌ Error logging automation for proposal ${proposal.id}:`, logError3);
          } else {
            console.log(`✅ Logged opened_not_clicked automation for proposal ${proposal.id}`);
          }

          await supabase
            .from('proposals')
            .update({ last_email_sent_at: now.toISOString() })
            .eq('id', proposal.id);

          actions.followups_sent++;
          continue;
        }

        // Rule 4: Send reminder for delivered but not opened
        const deliveredNotOpenedInitial = timingConfig.delivered_not_opened_days || 2;
        const deliveredNotOpenedRepeat = timingConfig.delivered_not_opened_repeat_days || 3;
        if (proposal.status === 'delivered' && daysSinceLastSent >= deliveredNotOpenedInitial && daysSinceLastFollowup >= deliveredNotOpenedRepeat) {
          console.log(`📧 Sending reminder for delivered proposal ${proposal.id}`);
          
          await sendFollowUpEmail(
            proposal.id,
            'delivered_not_opened',
            emailTemplates
          );
          actions.emails_sent++;
          
          // Rate limit delay after sending email
          await sleep(RATE_LIMIT_DELAY_MS);

          // Log the automation action with error handling
          const { error: logError4 } = await supabase
            .from('proposal_automation_log')
            .insert({
              proposal_id: proposal.id,
              automation_type: 'follow_up_email',
              trigger_event: 'delivered_not_opened_2_days',
              email_type: 'delivered_not_opened',
              old_status: proposal.status,
              new_status: proposal.status
            });

          if (logError4) {
            console.error(`❌ Error logging automation for proposal ${proposal.id}:`, logError4);
          } else {
            console.log(`✅ Logged delivered_not_opened automation for proposal ${proposal.id}`);
          }

          await supabase
            .from('proposals')
            .update({ last_email_sent_at: now.toISOString() })
            .eq('id', proposal.id);

          actions.reminders_sent++;
          continue;
        }

        // Rule 5: Send reminder for sent but not delivered
        const sentNotDeliveredInitial = timingConfig.sent_not_delivered_days || 3;
        const sentNotDeliveredRepeat = timingConfig.sent_not_delivered_repeat_days || 3;
        if (proposal.status === 'sent' && daysSinceLastSent >= sentNotDeliveredInitial && daysSinceLastFollowup >= sentNotDeliveredRepeat) {
          console.log(`📧 Sending reminder for sent proposal ${proposal.id}`);
          
          await sendFollowUpEmail(
            proposal.id,
            'sent_not_delivered',
            emailTemplates
          );
          actions.emails_sent++;
          
          // Rate limit delay after sending email
          await sleep(RATE_LIMIT_DELAY_MS);

          // Log the automation action with error handling
          const { error: logError5 } = await supabase
            .from('proposal_automation_log')
            .insert({
              proposal_id: proposal.id,
              automation_type: 'follow_up_email',
              trigger_event: 'sent_not_delivered_3_days',
              email_type: 'sent_not_delivered',
              old_status: proposal.status,
              new_status: proposal.status
            });

          if (logError5) {
            console.error(`❌ Error logging automation for proposal ${proposal.id}:`, logError5);
          } else {
            console.log(`✅ Logged sent_not_delivered automation for proposal ${proposal.id}`);
          }

          await supabase
            .from('proposals')
            .update({ last_email_sent_at: now.toISOString() })
            .eq('id', proposal.id);

          actions.reminders_sent++;
        }

      } catch (error) {
        console.error(`❌ Error processing proposal ${proposal.id}:`, error);
        actions.errors++;
      }
    }

    console.log("\n✅ AUTOMATION COMPLETE");
    console.log(`📊 Summary:
      - Emails sent: ${actions.emails_sent}
      - Reminders sent: ${actions.reminders_sent}
      - Follow-ups sent: ${actions.followups_sent}
      - Marked stale: ${actions.marked_stale}
      - Errors: ${actions.errors}
    `);

    return new Response(
      JSON.stringify({ 
        success: true, 
        ...actions,
        timestamp: now.toISOString() 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error("❌ Automation error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function sendFollowUpEmail(
  proposalId: string,
  followUpType: 'delivered_not_opened' | 'opened_not_clicked' | 'clicked_not_signed' | 'sent_not_delivered' | 'graceful_exit',
  emailTemplates: any
) {
  // Fetch full proposal data with client and agent details
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  const { data: proposal, error: proposalError } = await supabase
    .from('proposals')
    .select(`
      *,
      agent:profiles!proposals_agent_id_fkey(first_name, last_name, email, phone),
      client:clients!proposals_client_reference_id_fkey(first_name, last_name, email)
    `)
    .eq('id', proposalId)
    .single();
  
  if (proposalError || !proposal) {
    console.error(`Error fetching proposal ${proposalId}:`, proposalError);
    throw new Error(`Failed to fetch proposal data: ${proposalError?.message}`);
  }

  // Extract client info (with fallbacks to content)
  const clientInfo = proposal.content?.clientInfo || {};
  const clientEmail = proposal.client?.email || clientInfo.email;
  const clientFirstName = proposal.client?.first_name || clientInfo.firstName || clientInfo.first_name || '';
  const clientLastName = proposal.client?.last_name || clientInfo.lastName || clientInfo.last_name || '';
  const clientName = `${clientFirstName} ${clientLastName}`.trim() || clientInfo.name || 'Client';
  
  // Extract agent info
  const agentFirstName = proposal.agent?.first_name || '';
  const agentLastName = proposal.agent?.last_name || '';
  const agentName = `${agentFirstName} ${agentLastName}`.trim() || 'Your Agent';
  const agentEmail = proposal.agent?.email || 'support@crunchcarbon.com';

  // Suppression + cooldown guard — single source of truth for client email safety
  if (clientEmail) {
    const { data: canSend, error: guardError } = await supabase.rpc('can_send_client_email', {
      p_email: clientEmail,
      p_cooldown_days: 7,
    });
    if (guardError) {
      console.error(`⚠️ can_send_client_email guard failed for ${clientEmail}:`, guardError);
    } else if (canSend === false) {
      console.log(`🛑 Skipping ${followUpType} for proposal ${proposalId} — ${clientEmail} suppressed or in cooldown window`);
      await supabase.from('proposal_automation_log').insert({
        proposal_id: proposalId,
        automation_type: 'email_skipped',
        trigger_event: 'suppression_or_cooldown',
        email_type: followUpType,
        details: { recipient: clientEmail, reason: 'suppressed_or_cooldown' },
      });
      return { skipped: true, reason: 'suppressed_or_cooldown' } as any;
    }
  }

  // Calculate carbon credits and revenue
  const systemSizeKwp = proposal.system_size_kwp || 0;
  const annualEnergy = systemSizeKwp * 1200; // Default generation factor
  const carbonCredits = (annualEnergy / 1000) * 0.5; // Default carbon factor
  const clientSharePercent = proposal.client_share_percentage || 80;
  const carbonPrice = 50; // Default price (could fetch dynamic pricing)
  const clientShareRevenue = (carbonCredits * carbonPrice * clientSharePercent) / 100;
  
  // Build proposal URL using SITE_URL environment variable
  const siteUrl = Deno.env.get('SITE_URL') || 'https://crunchcarbon.com';
  const proposalUrl = `${siteUrl}/proposals/${proposal.id}?token=${proposal.invitation_token}`;

  // Format expiry date for email template
  const expiryDate = proposal.invitation_expires_at 
    ? new Date(proposal.invitation_expires_at).toLocaleDateString('en-ZA', {
        year: 'numeric',
        month: 'long', 
        day: 'numeric'
      })
    : 'the expiry date shown in your proposal';

  // Get template from config
  const template = emailTemplates[followUpType];
  if (!template) {
    console.error(`No template found for ${followUpType}`);
    throw new Error(`Template not found: ${followUpType}`);
  }

  // Create data object with BOTH snake_case and camelCase for backward compatibility
  const data = {
    // Snake_case (primary format)
    client_name: clientName,
    proposal_title: proposal.title,
    system_size: `${Math.round(systemSizeKwp)} kWp`,
    annual_energy: `${Math.round(annualEnergy).toLocaleString()} kWh`,
    carbon_credits: Math.round(carbonCredits),
    client_share: `R ${Math.round(clientShareRevenue).toLocaleString()}`,
    agent_name: agentName,
    agent_email: agentEmail,
    proposal_url: proposalUrl,
    expiry_date: expiryDate,
    
    // CamelCase (for backward compatibility)
    clientName: clientName,
    proposalTitle: proposal.title,
    systemSize: `${Math.round(systemSizeKwp)} kWp`,
    annualEnergy: `${Math.round(annualEnergy).toLocaleString()} kWh`,
    carbonCredits: Math.round(carbonCredits),
    clientShare: `R ${Math.round(clientShareRevenue).toLocaleString()}`,
    agentName: agentName,
    agentEmail: agentEmail,
    proposalUrl: proposalUrl,
    expiryDate: expiryDate
  };

  // Replace all placeholders in subject and html
  let subject = template.subject;
  let html = template.html;
  
  for (const [key, value] of Object.entries(data)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    subject = subject.replace(regex, String(value));
    html = html.replace(regex, String(value));
  }

  // Retry logic with exponential backoff for rate limiting
  const maxRetries = 3;
  let lastError: any = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const emailResponse = await resend.emails.send({
        from: 'Crunch Carbon <proposals@crunchcarbon.com>',
        to: [clientEmail],
        cc: [agentEmail],
        subject: subject,
        html: html
      });

      console.log(`✅ Follow-up email sent to ${clientEmail} for proposal ${proposalId}:`, emailResponse);
      return emailResponse;
      
    } catch (error: any) {
      lastError = error;
      const statusCode = error?.statusCode || error?.status;
      
      // Check if it's a rate limit error (429)
      if (statusCode === 429 && attempt < maxRetries - 1) {
        const backoffMs = Math.pow(2, attempt) * 2000; // 2s, 4s, 8s
        console.log(`⏳ Rate limited (429), waiting ${backoffMs}ms before retry ${attempt + 2}/${maxRetries}...`);
        await sleep(backoffMs);
        continue;
      }
      
      // For other errors or final retry, throw
      console.error(`❌ Email send failed for proposal ${proposalId} (attempt ${attempt + 1}/${maxRetries}):`, error);
      throw error;
    }
  }
  
  // Should not reach here, but just in case
  throw lastError || new Error('Email send failed after retries');
}
