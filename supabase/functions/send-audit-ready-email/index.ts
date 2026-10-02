import "../_shared/sandbox.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";
import { corsHeaders } from "../_shared/cors.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { projectOnboardingId } = await req.json();
    if (!projectOnboardingId) {
      return new Response(JSON.stringify({ error: "projectOnboardingId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch onboarding → proposal → client
    const { data: onboarding, error: obError } = await supabase
      .from("project_onboarding")
      .select("id, proposal_id")
      .eq("id", projectOnboardingId)
      .single();

    if (obError || !onboarding) {
      console.error("Onboarding lookup failed:", obError);
      return new Response(JSON.stringify({ error: "Project onboarding not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: proposal, error: propError } = await supabase
      .from("proposals")
      .select("id, title, system_size_kwp, client_reference_id, content, agent_id, profiles:agent_id(email, first_name, last_name)")
      .eq("id", onboarding.proposal_id)
      .single();

    if (propError || !proposal) {
      console.error("Proposal lookup failed:", propError);
      return new Response(JSON.stringify({ error: "Proposal not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve client
    let clientName = "Valued Client";
    let clientEmail: string | null = null;

    if (proposal.client_reference_id) {
      const { data: client } = await supabase
        .from("clients")
        .select("first_name, last_name, company_name, email")
        .eq("id", proposal.client_reference_id)
        .single();

      if (client) {
        clientName = [client.first_name, client.last_name].filter(Boolean).join(" ") || client.company_name || "Valued Client";
        clientEmail = client.email;
      }
    }

    // Fallback to proposal content snapshot
    if (!clientEmail) {
      const ci = (proposal.content as any)?.clientInfo;
      if (ci?.email) {
        clientEmail = ci.email;
        if (!clientName || clientName === "Valued Client") {
          clientName = ci.name || ci.companyName || "Valued Client";
        }
      }
    }

    if (!clientEmail) {
      console.error("No client email found for proposal", proposal.id);
      return new Response(JSON.stringify({ error: "No client email found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const projectName = proposal.title || "Your Solar Project";
    const systemSize = proposal.system_size_kwp ? `${proposal.system_size_kwp} kWp` : "";

    // Build agent CC
    const agentProfile = proposal.profiles as any;
    const ccAddresses: string[] = [];
    if (agentProfile?.email) {
      ccAddresses.push(agentProfile.email);
    }

    const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;">
        <!-- Header -->
        <tr><td style="background-color:#16a34a;padding:32px 40px;text-align:center;">
          <h1 style="color:#ffffff;margin:0;font-size:24px;">✅ Your Project is Audit Ready</h1>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:40px;">
          <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 16px;">
            Dear ${clientName},
          </p>
          <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 16px;">
            We're pleased to confirm that your solar project <strong>${projectName}</strong>${systemSize ? ` (${systemSize})` : ""} has been reviewed and marked as <strong>Audit Ready</strong>.
          </p>
          <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 16px;">
            This means all the required documentation, system details, and data access have been verified and your project is now ready to proceed through the carbon credit issuance process.
          </p>

          <!-- Milestones -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
            <tr><td style="background-color:#f9fafb;padding:16px 20px;border-bottom:1px solid #e5e7eb;">
              <strong style="color:#111827;font-size:15px;">What Happens Next</strong>
            </td></tr>
            <tr><td style="padding:16px 20px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr><td style="padding:8px 0;color:#374151;font-size:14px;">1️⃣&nbsp; <strong>Energy Data Analysis</strong> — We analyse your system's generation data</td></tr>
                <tr><td style="padding:8px 0;color:#374151;font-size:14px;">2️⃣&nbsp; <strong>Independent External Audit</strong> — Third-party verification of your project</td></tr>
                <tr><td style="padding:8px 0;color:#374151;font-size:14px;">3️⃣&nbsp; <strong>Verra Audit</strong> — Registry-level validation and approval</td></tr>
                <tr><td style="padding:8px 0;color:#374151;font-size:14px;">4️⃣&nbsp; <strong>Carbon Credit Issuance</strong> — VCUs issued to your project</td></tr>
                <tr><td style="padding:8px 0;color:#374151;font-size:14px;">5️⃣&nbsp; <strong>Sale of Credits</strong> — Credits marketed and sold</td></tr>
                <tr><td style="padding:8px 0;color:#374151;font-size:14px;">6️⃣&nbsp; <strong>Payment</strong> — Revenue distributed to you</td></tr>
              </table>
            </td></tr>
          </table>

          <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 16px;">
            We will keep you updated as your project progresses through each milestone. If you have any questions in the meantime, please don't hesitate to reach out.
          </p>
          <p style="color:#374151;font-size:16px;line-height:1.6;margin:24px 0 0;">
            Warm regards,<br/><strong>The Crunch Carbon Team</strong>
          </p>
        </td></tr>
        <!-- Footer -->
        <tr><td style="background-color:#f9fafb;padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb;">
          <p style="color:#9ca3af;font-size:12px;margin:0;">
            © ${new Date().getFullYear()} Crunch Carbon · <a href="https://crunchcarbon.com" style="color:#16a34a;text-decoration:none;">crunchcarbon.com</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const emailResponse = await resend.emails.send({
      from: "Crunch Carbon <noreply@crunchcarbon.com>",
      to: [clientEmail],
      cc: ccAddresses.length > 0 ? ccAddresses : undefined,
      subject: `Your Solar Project is Audit Ready — ${projectName}`,
      html: emailHtml,
      headers: { "X-Entity-Ref-ID": `audit-ready-${onboarding.id}` },
    });

    console.log("Audit ready email sent:", emailResponse);

    // Log to proposal_automation_log
    if (emailResponse?.data?.id) {
      const { error: logError } = await supabase
        .from("proposal_automation_log")
        .insert({
          proposal_id: proposal.id,
          action: "audit_ready_notification",
          email_message_id: emailResponse.data.id,
          recipient_email: clientEmail,
          details: { projectOnboardingId, projectName, systemSize },
        });
      if (logError) console.error("Failed to log email:", logError);
    }

    return new Response(JSON.stringify({ success: true, messageId: emailResponse?.data?.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("send-audit-ready-email error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
