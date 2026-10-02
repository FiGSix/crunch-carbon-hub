import "../_shared/sandbox.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

// Helper to avoid Resend rate limits (2 req/sec max)
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "https://uyjryuopuqgmsvayiccl.supabase.co";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify admin access
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl!, supabaseServiceKey!);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user is admin
    const { data: roleData } = await supabase.rpc("get_primary_role", { _user_id: user.id });
    if (roleData !== "admin") {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { testEmail = "shaun@radiant.africa", templateType = "all" } = await req.json();

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resend = new Resend(resendApiKey);
    const results = [];

    // Fetch email templates from database
    const { data: templatesData, error: templatesError } = await supabase
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'email_automation_templates')
      .single();

    if (templatesError || !templatesData) {
      console.error("Failed to load templates from database:", templatesError);
      return new Response(
        JSON.stringify({ error: "Failed to load email templates from database" }), 
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const templates = templatesData.setting_value as any;

    // Sample proposal data for testing
    const sampleProposal = {
      id: "test-proposal-id",
      title: "Test Solar Installation Project",
      client_name: "Test Client",
      clientName: "Test Client",
      agent_name: "Test Agent",
      agentName: "Test Agent",
      agent_email: "agent@test.com",
      agent_phone: "+27 123 456 789",
      system_size_kwp: 150,
      systemSize: "150 kWp",
      annual_energy: 180000,
      carbonCredits: 850,
      creditValue: 42500,
      invitation_token: "test-token-123",
    };

    const baseUrl = "https://uyjryuopuqgmsvayiccl.supabase.co";
    const invitationUrl = `${baseUrl}/functions/v1/accept-proposal?token=${sampleProposal.invitation_token}`;
    const onboardingUrl = `${baseUrl}/onboarding/${sampleProposal.id}`;
    
    // Add URLs to sample data
    sampleProposal.proposalUrl = invitationUrl;
    sampleProposal.onboardingUrl = onboardingUrl;

    // Helper function to replace placeholders in template
    const replacePlaceholders = (template: string, data: any): string => {
      let result = template;
      
      result = result.replace(/\{\{clientName\}\}/g, data.clientName);
      result = result.replace(/\{\{proposalTitle\}\}/g, data.title);
      result = result.replace(/\{\{proposalUrl\}\}/g, data.proposalUrl);
      result = result.replace(/\{\{onboardingUrl\}\}/g, data.onboardingUrl);
      result = result.replace(/\{\{agentName\}\}/g, data.agentName);
      result = result.replace(/\{\{agentEmail\}\}/g, data.agent_email);
      result = result.replace(/\{\{systemSize\}\}/g, data.systemSize);
      result = result.replace(/\{\{carbonCredits\}\}/g, data.carbonCredits.toString());
      result = result.replace(/\{\{creditValue\}\}/g, `R ${data.creditValue.toLocaleString()}`);
      
      return result;
    };

    // Template 1: Delivered but Not Opened
    if (templateType === "all" || templateType === "delivered_not_opened") {
      try {
        const template = templates.delivered_not_opened;
        const html = replacePlaceholders(template.html, sampleProposal);
        
        const result = await resend.emails.send({
          from: "Crunch Carbon <proposals@crunchcarbon.com>",
          to: [testEmail],
          subject: replacePlaceholders(template.subject, sampleProposal),
          html: html,
        });
        
        console.log("Template 1 (delivered_not_opened) sent:", result);
        results.push({ template: "delivered_not_opened", success: true, emailId: result.data?.id });
      } catch (error) {
        console.error("Error sending template 1:", error);
        results.push({ template: "delivered_not_opened", success: false, error: error.message });
      }
      
      if (templateType === "all") await delay(600);
    }

    // Template 2: Opened but Not Clicked
    if (templateType === "all" || templateType === "opened_not_clicked") {
      try {
        const template = templates.opened_not_clicked;
        const html = replacePlaceholders(template.html, sampleProposal);
        
        const result = await resend.emails.send({
          from: "Crunch Carbon <proposals@crunchcarbon.com>",
          to: [testEmail],
          subject: replacePlaceholders(template.subject, sampleProposal),
          html: html,
        });
        
        console.log("Template 2 (opened_not_clicked) sent:", result);
        results.push({ template: "opened_not_clicked", success: true, emailId: result.data?.id });
      } catch (error) {
        console.error("Error sending template 2:", error);
        results.push({ template: "opened_not_clicked", success: false, error: error.message });
      }
      
      if (templateType === "all") await delay(600);
    }

    // Template 3: Clicked but Not Signed
    if (templateType === "all" || templateType === "clicked_not_signed") {
      try {
        const template = templates.clicked_not_signed;
        const html = replacePlaceholders(template.html, sampleProposal);
        
        const result = await resend.emails.send({
          from: "Crunch Carbon <proposals@crunchcarbon.com>",
          to: [testEmail],
          subject: replacePlaceholders(template.subject, sampleProposal),
          html: html,
        });
        
        console.log("Template 3 (clicked_not_signed) sent:", result);
        results.push({ template: "clicked_not_signed", success: true, emailId: result.data?.id });
      } catch (error) {
        console.error("Error sending template 3:", error);
        results.push({ template: "clicked_not_signed", success: false, error: error.message });
      }
      
      if (templateType === "all") await delay(600);
    }

    // Template 4: Graceful Exit (Final Reminder)
    if (templateType === "all" || templateType === "graceful_exit") {
      try {
        const template = templates.graceful_exit;
        const html = replacePlaceholders(template.html, sampleProposal);
        
        const result = await resend.emails.send({
          from: "Crunch Carbon <proposals@crunchcarbon.com>",
          to: [testEmail],
          subject: replacePlaceholders(template.subject, sampleProposal),
          html: html,
        });
        
        console.log("Template 4 (graceful_exit) sent:", result);
        results.push({ template: "graceful_exit", success: true, emailId: result.data?.id });
      } catch (error) {
        console.error("Error sending template 4:", error);
        results.push({ template: "graceful_exit", success: false, error: error.message });
      }
      
      if (templateType === "all") await delay(600);
    }

    // Template 5: Accepted Thank-You
    if (templateType === "all" || templateType === "accepted_thank_you") {
      try {
        const template = templates.accepted_thank_you;
        const html = replacePlaceholders(template.html, sampleProposal);
        
        const result = await resend.emails.send({
          from: "Crunch Carbon <proposals@crunchcarbon.com>",
          to: [testEmail],
          subject: replacePlaceholders(template.subject, sampleProposal),
          html: html,
        });
        
        console.log("Template 5 (accepted_thank_you) sent:", result);
        results.push({ template: "accepted_thank_you", success: true, emailId: result.data?.id });
      } catch (error) {
        console.error("Error sending template 5:", error);
        results.push({ template: "accepted_thank_you", success: false, error: error.message });
      }
      
      if (templateType === "all") await delay(600);
    }

    // Template 6: Cession Reminder
    if (templateType === "all" || templateType === "cession_reminder") {
      try {
        const template = templates.cession_reminder;
        const html = replacePlaceholders(template.html, sampleProposal);
        
        const result = await resend.emails.send({
          from: "Crunch Carbon <proposals@crunchcarbon.com>",
          to: [testEmail],
          subject: replacePlaceholders(template.subject, sampleProposal),
          html: html,
        });
        
        console.log("Template 6 (cession_reminder) sent:", result);
        results.push({ template: "cession_reminder", success: true, emailId: result.data?.id });
      } catch (error) {
        console.error("Error sending template 6:", error);
        results.push({ template: "cession_reminder", success: false, error: error.message });
      }
      
      if (templateType === "all") await delay(600);
    }

    // Template 7: Onboarding Idle Help
    if (templateType === "all" || templateType === "onboarding_idle_help") {
      try {
        const template = templates.onboarding_idle_help;
        const html = replacePlaceholders(template.html, sampleProposal);
        
        const result = await resend.emails.send({
          from: "Crunch Carbon <proposals@crunchcarbon.com>",
          to: [testEmail],
          subject: replacePlaceholders(template.subject, sampleProposal),
          html: html,
        });
        
        console.log("Template 7 (onboarding_idle_help) sent:", result);
        results.push({ template: "onboarding_idle_help", success: true, emailId: result.data?.id });
      } catch (error) {
        console.error("Error sending template 7:", error);
        results.push({ template: "onboarding_idle_help", success: false, error: error.message });
      }
    }

    // Return results
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    return new Response(
      JSON.stringify({ 
        message: templateType === "all" 
          ? `Sent ${successCount} out of 7 test emails successfully${failCount > 0 ? ` (${failCount} failed)` : ''}`
          : successCount > 0 
            ? `Template '${templateType}' sent successfully`
            : `Failed to send template '${templateType}'`,
        results,
        testEmail 
      }), 
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("Error in test-proposal-emails function:", error);
    return new Response(
      JSON.stringify({ error: error.message }), 
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
