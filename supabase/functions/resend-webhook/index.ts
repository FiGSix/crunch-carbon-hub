import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isPrimaryRecipient, isRetryableBounce } from './bounce-classification.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, resend-signature',
};

interface ResendWebhookEvent {
  type: string;
  created_at: string;
  data: {
    created_at: string;
    email_id: string;
    from: string;
    to: string[];
    subject: string;
    click?: {
      ipAddress: string;
      link: string;
      timestamp: string;
      userAgent: string;
    };
    bounce?: {
      bouncedAt: string;
      reason: string;
      type?: string;
      subType?: string;
    };
  };
}

serve(async (req) => {
  console.log("=== 📧 RESEND WEBHOOK INVOKED ===");
  console.log("Timestamp:", new Date().toISOString());
  console.log("Method:", req.method);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Parse webhook payload
    const event: ResendWebhookEvent = await req.json();
    console.log('📨 Received Resend webhook:', {
      type: event.type,
      email_id: event.data.email_id,
      to: event.data.to[0]
    });

    // Phase 3: Update weekly_roundup CTA events if this email_id matches one we sent.
    // Best-effort, fire-and-forget — does not block proposal-event processing.
    await updateWeeklyRoundupCtaEvent(supabaseAdmin, event).catch((e) =>
      console.error('[email_cta_events] update failed:', e?.message)
    );

    // Extract proposal_id from email metadata
    const proposalTracking = await extractProposalTrackingFromEmail(
      supabaseAdmin,
      event.data.email_id,
      event.data.to[0]
    );

    // Broadcast bounces/complaints must be captured before the proposal early return,
    // otherwise the suppression list goes blind on the new sending subdomain.
    if (event.type === 'email.bounced' || event.type === 'email.complained') {
      const handled = await handleBroadcastReputationEvent(supabaseAdmin, event);
      if (handled) {
        return new Response(JSON.stringify({ received: true, broadcast: true, type: event.type }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    if (!proposalTracking) {
      console.warn('⚠️  Could not find proposal for email:', event.data.email_id);
      return new Response(JSON.stringify({ received: true, warning: 'proposal_not_found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const proposalId = proposalTracking.proposalId;
    const webhookRecipient = event.data.to?.[0];
    const primaryRecipientEvent = isPrimaryRecipient(webhookRecipient, proposalTracking.primaryRecipient);
    const retryableBounce = event.type === 'email.bounced' && isRetryableBounce(event.data.bounce);

    console.log('✅ Found proposal:', proposalId);

    // Store email event
    const { data: emailEvent, error: eventError } = await supabaseAdmin
      .from('email_events')
      .insert({
        proposal_id: proposalId,
        event_type: event.type,
        message_id: event.data.email_id,
        recipient_email: event.data.to[0],
        subject: event.data.subject,
        occurred_at: event.created_at,
        user_agent: event.data.click?.userAgent,
        click_url: event.data.click?.link,
        bounce_reason: event.data.bounce?.reason,
        raw_payload: event
      })
      .select()
      .single();

    if (eventError) {
      console.error('❌ Failed to store email event:', eventError);
      throw eventError;
    }

    console.log('✅ Email event stored:', emailEvent.id);

    // Resend reports failures per recipient. A failure for the copied agent must
    // never change the client's proposal, and transient failures remain retryable.
    const shouldAffectProposal = primaryRecipientEvent && !retryableBounce;
    if (shouldAffectProposal) {
      await updateProposalEngagement(supabaseAdmin, proposalId, event.type, event.created_at);
    }

    const statusUpdated = shouldAffectProposal
      ? await processStatusUpdate(supabaseAdmin, proposalId, event.type)
      : false;

    // Mark event as processed
    await supabaseAdmin
      .from('email_events')
      .update({ 
        processed_at: new Date().toISOString(),
        status_update_triggered: statusUpdated 
      })
      .eq('id', emailEvent.id);

    console.log('✅ Webhook processed successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        proposal_id: proposalId,
        event_type: event.type,
        status_updated: statusUpdated
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('❌ Webhook processing error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});


/**
 * Broadcast bounce/complaint handling. Returns true when the event belonged to a
 * broadcast (and has been fully recorded), false when it is not a broadcast event.
 * Opens and clicks are deliberately not handled yet — reporting comes later.
 */
async function handleBroadcastReputationEvent(
  supabase: any,
  event: ResendWebhookEvent
): Promise<boolean> {
  const messageId = event.data.email_id;
  if (!messageId) return false;

  const { data: recipient } = await supabase
    .from('broadcast_recipients')
    .select('id, email, campaign_id')
    .eq('message_id', messageId)
    .maybeSingle();

  if (!recipient) return false;

  const reason = event.type === 'email.complained' ? 'complaint' : 'bounce';
  const email = (event.data.to?.[0] || recipient.email || '').toLowerCase();

  await supabase.from('email_events').insert({
    proposal_id: null,
    broadcast_recipient_id: recipient.id,
    event_type: event.type,
    message_id: messageId,
    recipient_email: email,
    subject: event.data.subject,
    occurred_at: event.created_at,
    bounce_reason: event.data.bounce?.reason,
    raw_payload: event,
    processed_at: new Date().toISOString()
  });

  await supabase
    .from('broadcast_recipients')
    .update({
      status: 'failed',
      error: `${reason}: ${event.data.bounce?.reason ?? 'reported by Resend'}`
    })
    .eq('id', recipient.id);

  // Expression unique index on (lower(email), reason) — check before inserting.
  const { data: existing } = await supabase
    .from('client_email_suppressions')
    .select('id')
    .ilike('email', email)
    .eq('reason', reason)
    .maybeSingle();

  if (!existing) {
    await supabase.from('client_email_suppressions').insert({
      email,
      reason,
      source: 'resend_webhook_broadcast',
      notes: `broadcast campaign ${recipient.campaign_id}`
    });
  }

  console.log(`[broadcast] recorded ${reason} for ${email}`);
  return true;
}

async function updateWeeklyRoundupCtaEvent(supabase: any, event: ResendWebhookEvent): Promise<void> {
  const messageId = event.data.email_id;
  if (!messageId) return;

  // Only act if this message_id was logged by send-weekly-roundup
  const { data: existing } = await supabase
    .from('email_cta_events')
    .select('id')
    .eq('message_id', messageId)
    .limit(1)
    .maybeSingle();
  if (!existing) return;

  const nowIso = event.created_at || new Date().toISOString();
  const update: Record<string, any> = {};
  if (event.type === 'email.opened' || event.type === 'email.delivered') {
    update.opened_at = nowIso;
  }
  if (event.type === 'email.clicked') {
    update.clicked_at = nowIso;
    update.target_url = event.data.click?.link ?? null;
    update.user_agent = event.data.click?.userAgent ?? null;
  }
  if (Object.keys(update).length === 0) return;

  await supabase.from('email_cta_events').update(update).eq('message_id', messageId);
  console.log(`[email_cta_events] updated ${event.type} for message ${messageId}`);
}

async function extractProposalTrackingFromEmail(
  supabase: any,
  emailId: string,
  recipientEmail: string
): Promise<{ proposalId: string; primaryRecipient: string } | null> {
  // ONLY match emails that were explicitly logged as proposal emails
  // This prevents agent invitations or other emails from being
  // incorrectly associated with proposals
  const { data: logEntry } = await supabase
    .from('proposal_automation_log')
    .select('proposal_id, details')
    .eq('email_message_id', emailId)
    .single();

  if (logEntry) {
    console.log('📋 Found proposal from automation log');
    const primaryRecipient = logEntry.details?.recipient;
    if (!primaryRecipient) {
      console.warn('⚠️ Proposal email log has no primary recipient:', emailId);
      return null;
    }
    return { proposalId: logEntry.proposal_id, primaryRecipient };
  }

  // DO NOT fallback to email matching - this causes agent invitations
  // and other unrelated emails to be incorrectly associated with proposals
  console.log('⚠️ No proposal found in automation log for email:', emailId, 'to:', recipientEmail);
  return null;
}

async function updateProposalEngagement(
  supabase: any,
  proposalId: string,
  eventType: string,
  eventTimestamp: string
) {
  const isEngagement = ['email.opened', 'email.clicked'].includes(eventType);

  if (isEngagement) {
    console.log('📊 Incrementing engagement count');
    await supabase.rpc('increment_proposal_engagement', {
      proposal_id: proposalId,
      event_type: eventType
    });
  }

  // Update last email event type and timestamp for all events
  await supabase
    .from('proposals')
    .update({
      last_email_event_type: eventType,
      last_email_sent_at: eventTimestamp
    })
    .eq('id', proposalId);
}

async function processStatusUpdate(
  supabase: any,
  proposalId: string,
  eventType: string
): Promise<boolean> {
  const { data: proposal } = await supabase
    .from('proposals')
    .select('status, automation_paused')
    .eq('id', proposalId)
    .single();

  if (!proposal) {
    console.warn('⚠️  Proposal not found for status update');
    return false;
  }

  if (proposal.automation_paused) {
    console.log('⏸️  Automation paused for this proposal');
    return false;
  }

  let newStatus: string | null = null;

  // Status transition rules based on email events
  switch (eventType) {
    case 'email.delivered':
      // Removed 'pending' - now uses draft/sent only for pre-delivery states
      if (['sent', 'draft'].includes(proposal.status)) {
        newStatus = 'delivered';
      }
      break;
    case 'email.opened':
      // Removed 'pending' - progression from draft/sent/delivered to opened
      if (['sent', 'delivered', 'draft'].includes(proposal.status)) {
        newStatus = 'opened';
      }
      break;
    case 'email.clicked':
      // Removed 'pending' - full pre-view status chain
      if (['sent', 'delivered', 'opened', 'draft'].includes(proposal.status)) {
        newStatus = 'viewed'; // Clicking email link = viewing proposal
      }
      break;
    case 'email.bounced':
      newStatus = 'bounced';
      
      // Create admin notification for manual follow-up
      const { data: bouncedProposal } = await supabase
        .from('proposals')
        .select('agent_id, title')
        .eq('id', proposalId)
        .single();
      
      if (bouncedProposal) {
        await supabase.from('notifications').insert({
          user_id: bouncedProposal.agent_id,
          type: 'error',
          title: 'Email Bounced - Manual Follow-Up Required',
          message: `Proposal "${bouncedProposal.title}" email bounced. Consider SMS/WhatsApp follow-up.`,
          related_type: 'proposal',
          related_id: proposalId
        });
      }
      break;
  }

  if (newStatus && newStatus !== proposal.status) {
    console.log(`🔄 Updating status: ${proposal.status} → ${newStatus}`);
    
    const { error } = await supabase.rpc('update_proposal_status_with_log', {
      proposal_id: proposalId,
      new_status: newStatus,
      trigger_event: eventType,
      is_automated: true
    });

    if (error) {
      console.error('❌ Failed to update status:', error);
      return false;
    }

    return true;
  }

  return false;
}
