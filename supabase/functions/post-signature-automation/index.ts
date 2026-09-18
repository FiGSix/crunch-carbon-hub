import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const AUTOMATION_REPAIR_CUTOFF = "2026-09-18T00:00:00+02:00";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  console.log("=== 🎉 POST-SIGNATURE AUTOMATION TRIGGERED ===");
  console.log(`Timestamp: ${new Date().toISOString()}`);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch configuration
    const { data: timingData } = await supabase
      .from("system_settings")
      .select("setting_value")
      .eq("setting_key", "email_automation_timing")
      .single();

    const { data: templateData } = await supabase
      .from("system_settings")
      .select("setting_value")
      .eq("setting_key", "email_automation_templates")
      .single();

    const timingConfig = timingData?.setting_value as any;
    const emailTemplates = templateData?.setting_value as any;

    const now = new Date();
    const actions = {
      thank_you_sent: 0,
      cession_reminders: 0,
      onboarding_help: 0,
      errors: 0,
    };

    // The signing function already sends the signed agreement and next steps
    // immediately. Do not send a second overlapping thank-you email.

    // ============= RULE 2: Cession Reminder (+2 Days) =============
    const cessionReminderDays = timingConfig?.cession_reminder_days || 2;

    const { data: cessionProposals } = await supabase
      .from("proposals")
      .select(
        `
        id, title, status, signed_at, agent_id, content,
        project_onboarding!inner(id, assigned_epc_id, onboarding_complete, submitted_for_review)
      `,
      )
      .eq("status", "approved")
      .not("signed_at", "is", null)
      .gte("signed_at", AUTOMATION_REPAIR_CUTOFF)
      .eq("automation_paused", false)
      .eq("project_onboarding.onboarding_complete", false)
      .eq("project_onboarding.submitted_for_review", false)
      .is("deleted_at", null)
      .is("archived_at", null);

    for (const proposal of cessionProposals || []) {
      try {
        const daysSinceSigned = proposal.signed_at
          ? Math.floor(
              (now.getTime() - new Date(proposal.signed_at).getTime()) /
                (1000 * 60 * 60 * 24),
            )
          : 0;

        if (daysSinceSigned >= cessionReminderDays) {
          // Check if reminder already sent
          const { data: reminderLog } = await supabase
            .from("proposal_automation_log")
            .select("id")
            .eq("proposal_id", proposal.id)
            .eq("email_type", "cession_reminder")
            .single();

          if (!reminderLog) {
            console.log(
              `📋 Sending cession reminder for proposal ${proposal.id}`,
            );

            const clientInfo = proposal.content?.clientInfo || {};
            const clientEmail = clientInfo.email;
            const clientName = clientInfo.name || "Client";

            if (clientEmail) {
              const { data: agentProfile } = await supabase
                .from("profiles")
                .select("email, first_name, last_name")
                .eq("id", proposal.agent_id)
                .single();

              const agentEmail =
                agentProfile?.email || "support@crunchcarbon.com";
              const agentName =
                `${agentProfile?.first_name || ""} ${agentProfile?.last_name || ""}`.trim() ||
                "Your Agent";

              // Get EPC email if assigned
              const projectOnboarding = Array.isArray(
                proposal.project_onboarding,
              )
                ? proposal.project_onboarding[0]
                : proposal.project_onboarding;

              let epcEmail = null;
              if (projectOnboarding?.assigned_epc_id) {
                const { data: epcProfile } = await supabase
                  .from("solar_installers")
                  .select("email")
                  .eq("id", projectOnboarding.assigned_epc_id)
                  .single();
                epcEmail = epcProfile?.email;
              }

              await sendPostSignatureEmail(
                clientEmail,
                clientName,
                proposal.title,
                proposal.id,
                projectOnboarding.id,
                agentEmail,
                agentName,
                "cession_reminder",
                emailTemplates,
                epcEmail,
              );

              await supabase.from("proposal_automation_log").insert({
                proposal_id: proposal.id,
                automation_type: "post_signature_email",
                trigger_event: `cession_reminder_${cessionReminderDays}_days`,
                email_type: "cession_reminder",
                old_status: proposal.status,
                new_status: proposal.status,
              });

              actions.cession_reminders++;
            }
          }
        }
      } catch (error) {
        console.error(
          `❌ Error processing cession proposal ${proposal.id}:`,
          error,
        );
        actions.errors++;
      }
    }

    // ============= RULE 3: Onboarding Idle Help (+5 Days) =============
    const onboardingIdleDays = timingConfig?.onboarding_idle_days || 5;

    const { data: onboardingProposals } = await supabase
      .from("proposals")
      .select(
        `
        id, title, status, signed_at, agent_id, content,
        project_onboarding!inner(id, onboarding_complete, submitted_for_review, last_activity_at)
      `,
      )
      .eq("status", "approved")
      .not("signed_at", "is", null)
      .gte("signed_at", AUTOMATION_REPAIR_CUTOFF)
      .eq("automation_paused", false)
      .eq("project_onboarding.onboarding_complete", false)
      .eq("project_onboarding.submitted_for_review", false)
      .is("deleted_at", null)
      .is("archived_at", null);

    for (const proposal of onboardingProposals || []) {
      try {
        const projectOnboarding = Array.isArray(proposal.project_onboarding)
          ? proposal.project_onboarding[0]
          : proposal.project_onboarding;

        const lastActivity = new Date(
          projectOnboarding?.last_activity_at || proposal.signed_at,
        );
        const daysSinceActivity = Math.floor(
          (now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24),
        );

        if (daysSinceActivity >= onboardingIdleDays) {
          // Check if help email sent recently (within 7 days)
          const { data: recentHelpLog } = await supabase
            .from("proposal_automation_log")
            .select("created_at")
            .eq("proposal_id", proposal.id)
            .eq("email_type", "onboarding_idle_help")
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

          const daysSinceLastHelp = recentHelpLog?.created_at
            ? Math.floor(
                (now.getTime() - new Date(recentHelpLog.created_at).getTime()) /
                  (1000 * 60 * 60 * 24),
              )
            : 999;

          if (daysSinceLastHelp >= 7) {
            console.log(
              `🆘 Sending onboarding help for idle proposal ${proposal.id} (${daysSinceActivity} days idle)`,
            );

            const clientInfo = proposal.content?.clientInfo || {};
            const clientEmail = clientInfo.email;
            const clientName = clientInfo.name || "Client";

            if (clientEmail) {
              const { data: agentProfile } = await supabase
                .from("profiles")
                .select("email, first_name, last_name")
                .eq("id", proposal.agent_id)
                .single();

              const agentEmail =
                agentProfile?.email || "support@crunchcarbon.com";
              const agentName =
                `${agentProfile?.first_name || ""} ${agentProfile?.last_name || ""}`.trim() ||
                "Your Agent";

              await sendPostSignatureEmail(
                clientEmail,
                clientName,
                proposal.title,
                proposal.id,
                onboardingProjectId(proposal),
                agentEmail,
                agentName,
                "onboarding_idle_help",
                emailTemplates,
              );

              await supabase.from("proposal_automation_log").insert({
                proposal_id: proposal.id,
                automation_type: "post_signature_email",
                trigger_event: `onboarding_idle_${onboardingIdleDays}_days`,
                email_type: "onboarding_idle_help",
                old_status: proposal.status,
                new_status: proposal.status,
              });

              actions.onboarding_help++;
            }
          }
        }
      } catch (error) {
        console.error(
          `❌ Error processing onboarding proposal ${proposal.id}:`,
          error,
        );
        actions.errors++;
      }
    }

    console.log("\n✅ POST-SIGNATURE AUTOMATION COMPLETE");
    console.log(`📊 Summary:
      - Thank-you emails sent: ${actions.thank_you_sent}
      - Cession reminders sent: ${actions.cession_reminders}
      - Onboarding help sent: ${actions.onboarding_help}
      - Errors: ${actions.errors}
    `);

    return new Response(
      JSON.stringify({
        success: true,
        ...actions,
        timestamp: now.toISOString(),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: any) {
    console.error("❌ Post-signature automation error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function sendPostSignatureEmail(
  clientEmail: string,
  clientName: string,
  proposalTitle: string,
  proposalId: string,
  projectOnboardingId: string,
  agentEmail: string,
  agentName: string,
  emailType: "accepted_thank_you" | "cession_reminder" | "onboarding_idle_help",
  emailTemplates: any,
  epcEmail?: string | null,
) {
  const onboardingPath = `/onboarding/${projectOnboardingId}?tab=onboarding`;
  const onboardingUrl = `https://crunchcarbon.com/login?returnTo=${encodeURIComponent(onboardingPath)}`;

  const template = emailTemplates[emailType];
  if (!template) {
    console.error(`No template found for ${emailType}`);
    throw new Error(`Template not found: ${emailType}`);
  }

  const replacements: Array<[RegExp, string]> = [
    [/\{\{clientName\}\}|\{\{client_name\}\}/g, clientName],
    [/\{\{proposalTitle\}\}|\{\{proposal_title\}\}/g, proposalTitle],
    [/\{\{onboardingUrl\}\}|\{\{onboarding_link\}\}/g, onboardingUrl],
    [/\{\{agentName\}\}|\{\{agent_name\}\}/g, agentName],
    [/\{\{agentEmail\}\}|\{\{agent_email\}\}/g, agentEmail],
  ];
  let subject = template.subject;
  let html = template.html;
  for (const [pattern, value] of replacements) {
    subject = subject.replace(pattern, value);
    html = html.replace(pattern, value);
  }

  // Build recipient list
  const toAddresses = [clientEmail];
  const ccAddresses = [agentEmail];

  if (epcEmail && emailType === "cession_reminder") {
    ccAddresses.push(epcEmail);
  }

  const emailResponse = await resend.emails.send({
    from: "Crunch Carbon <proposals@crunchcarbon.com>",
    to: toAddresses,
    cc: ccAddresses,
    subject: subject,
    html: html,
  });

  console.log(`✅ Post-signature email sent to ${clientEmail}:`, emailResponse);
  return emailResponse;
}

function onboardingProjectId(proposal: any): string {
  const project = Array.isArray(proposal.project_onboarding)
    ? proposal.project_onboarding[0]
    : proposal.project_onboarding;
  if (!project?.id)
    throw new Error(`No onboarding project found for proposal ${proposal.id}`);
  return project.id;
}
