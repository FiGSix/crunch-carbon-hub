import "../_shared/sandbox.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { Resend } from "npm:resend@2.0.0";
import { isBeforeNewProjectCutoff, VERRA_CUTOFF_CODE, VERRA_CUTOFF_NOTICE } from "../_shared/commissionCutoff.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EligibilityProposalRequest {
  firstName: string;
  lastName: string;
  email: string;
  address: string;
  systemSizeKwp: number;
  commissioningDate: string;
  eligibilityAnswers?: boolean[];
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase configuration");
    }

    if (!resendApiKey) {
      throw new Error("Missing Resend API key");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);

    const requestData: EligibilityProposalRequest = await req.json();
    
    console.log("Processing eligibility proposal for:", requestData.email);

    // Validate inputs
    if (!requestData.firstName || !requestData.lastName || !requestData.email) {
      throw new Error("Missing required fields");
    }

    // Silent block: check suppression list before doing anything else
    const normalizedEmail = requestData.email.toLowerCase().trim();
    const { data: isSuppressed, error: suppressionError } = await supabase.rpc(
      "is_client_email_suppressed",
      { p_email: normalizedEmail }
    );
    if (suppressionError) {
      console.warn("Suppression check failed, proceeding:", suppressionError);
    } else if (isSuppressed) {
      console.log("Blocked eligibility submission from suppressed email:", normalizedEmail);
      return new Response(
        JSON.stringify({ success: true, blocked: true, message: "Thanks — we've received your details and will be in touch." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (requestData.systemSizeKwp < 0.1 || requestData.systemSizeKwp > 30) {
      throw new Error("System size must be between 0.1 and 30 kWp");
    }

    // Validate commissioning date
    const minDate = new Date("2022-09-15");
    const commissioningDate = new Date(requestData.commissioningDate);
    if (commissioningDate < minDate) {
      throw new Error("Commissioning date must be on or after September 15, 2022");
    }
    if (isBeforeNewProjectCutoff(requestData.commissioningDate)) {
      return new Response(
        JSON.stringify({ error: VERRA_CUTOFF_NOTICE, code: VERRA_CUTOFF_CODE }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate estimated carbon credits (simplified formula)
    // Assuming ~1.5 MWh per kWp per year in South Africa
    // And ~1 carbon credit per MWh
    const annualEnergyMWh = requestData.systemSizeKwp * 1.5;
    const estimatedCredits = Math.round(annualEnergyMWh);
    const estimatedValue = estimatedCredits * 350; // Assuming R350 per credit

    // Check if client exists
    const { data: existingClient } = await supabase
      .from("clients")
      .select("id, user_id")
      .eq("email", requestData.email.toLowerCase().trim())
      .single();

    let clientId = existingClient?.id;
    let clientProfileId = existingClient?.user_id;

    // Create client if doesn't exist
    if (!clientId) {
      const { data: newClient, error: clientError } = await supabase
        .from("clients")
        .insert({
          email: requestData.email.toLowerCase().trim(),
          first_name: requestData.firstName,
          last_name: requestData.lastName,
          notes: `Eligibility check completed. Address: ${requestData.address}. System: ${requestData.systemSizeKwp} kWp`
        })
        .select('id')
        .single();

      if (clientError) {
        console.error("Error creating client:", clientError);
        throw clientError;
      }

      clientId = newClient.id;
      console.log("Created new client:", clientId);
    }

    // If client has no profile yet, check if one exists with matching email
    if (!clientProfileId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', requestData.email.toLowerCase().trim())
        .eq('role', 'client')
        .single();
      
      clientProfileId = profile?.id;
    }

    // Determine agent - use default Crunch Carbon agent
    const DEFAULT_CRUNCH_CARBON_AGENT = '6538aa1a-c0dc-4ce4-ab6f-bb4368d9fce1';
    const agentId = DEFAULT_CRUNCH_CARBON_AGENT;

    // Create proposal with all client links
    const { data: proposal, error: proposalError } = await supabase
      .from("proposals")
      .insert({
        title: `Carbon Credit Proposal - ${requestData.firstName} ${requestData.lastName}`,
        agent_id: agentId,                    // Set agent
        client_reference_id: clientId,        // Link to clients table
        client_id: clientProfileId,           // Link to profiles if exists
        status: "draft",
        system_size_kwp: requestData.systemSizeKwp,
        carbon_credits: estimatedCredits,
        project_info: {
          address: requestData.address,
          commissioning_date: requestData.commissioningDate,
          eligibility_check_completed: true
        },
        content: {
          system_details: {
            size: requestData.systemSizeKwp,
            location: requestData.address,
            commissioning_date: requestData.commissioningDate
          },
          estimated_credits: estimatedCredits,
          estimated_annual_value: estimatedValue
        }
      })
      .select()
      .single();

    if (proposalError) {
      console.error("Error creating proposal:", proposalError);
      throw proposalError;
    }

    console.log("Created proposal:", proposal.id);

    // Send email
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #f8f9fa; padding: 20px; text-align: center; border-radius: 8px; margin-bottom: 20px; }
            .content { background-color: #ffffff; padding: 20px; border-radius: 8px; }
            .highlight { background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; }
            .stats { display: grid; gap: 10px; margin: 20px 0; }
            .stat-item { padding: 10px; background-color: #f8f9fa; border-radius: 5px; }
            .cta { text-align: center; margin: 30px 0; }
            .button { display: inline-block; padding: 12px 30px; background-color: #ffc107; color: #000; text-decoration: none; border-radius: 5px; font-weight: bold; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0; color: #000;">🎉 Congratulations ${requestData.firstName}!</h1>
              <p style="margin: 10px 0 0 0;">Your solar system qualifies for carbon credits</p>
            </div>
            
            <div class="content">
              <h2>Your Carbon Credit Proposal</h2>
              
              <p>We're excited to confirm that your solar system meets all eligibility criteria for earning carbon credits. Here's what we found:</p>
              
              <div class="highlight">
                <h3 style="margin-top: 0;">System Details</h3>
                <div class="stats">
                  <div class="stat-item"><strong>System Size:</strong> ${requestData.systemSizeKwp} kWp</div>
                  <div class="stat-item"><strong>Location:</strong> ${requestData.address}</div>
                  <div class="stat-item"><strong>Commissioning Date:</strong> ${new Date(requestData.commissioningDate).toLocaleDateString('en-ZA')}</div>
                </div>
              </div>
              
              <div class="highlight">
                <h3 style="margin-top: 0;">Estimated Annual Returns</h3>
                <div class="stats">
                  <div class="stat-item"><strong>Carbon Credits:</strong> ~${estimatedCredits} credits/year</div>
                  <div class="stat-item"><strong>Estimated Value:</strong> R${estimatedValue.toLocaleString()}/year</div>
                </div>
                <p style="font-size: 12px; color: #666; margin: 10px 0 0 0;">*Estimates based on South African average solar generation and current carbon credit prices</p>
              </div>
              
              <h3>Next Steps</h3>
              <ol>
                <li><strong>Review:</strong> Our team will contact you within 2 business days</li>
                <li><strong>Documentation:</strong> We'll guide you through the simple onboarding process</li>
                <li><strong>Sign:</strong> Complete the Cession Agreement (we handle all the admin)</li>
                <li><strong>Earn:</strong> Start earning passive income from your solar system</li>
              </ol>
              
              <div class="cta">
                <p style="margin-bottom: 15px;">Questions? We're here to help.</p>
                <a href="mailto:info@crunchcarbon.com" class="button">Contact Us</a>
              </div>
              
              <p style="margin-top: 30px;">Welcome to the Crunch Carbon family! Together, we're making clean energy profitable and accelerating South Africa's renewable future.</p>
            </div>
            
            <div class="footer">
              <p><strong>Crunch Carbon</strong></p>
              <p>Turning your solar impact into income</p>
              <p style="font-size: 12px; color: #999; margin-top: 20px;">
                This is an automated message. Proposal ID: ${proposal.id}
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    const emailResponse = await resend.emails.send({
      from: "Crunch Carbon <onboarding@resend.dev>",
      to: [requestData.email],
      subject: `Carbon Credit Proposal - ${requestData.firstName} ${requestData.lastName}`,
      html: emailHtml,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({
        success: true,
        proposalId: proposal.id,
        clientId: clientId,
        estimatedCredits,
        estimatedValue,
        emailId: emailResponse.id
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error: any) {
    console.error("Error in send-eligibility-proposal:", error);
    return new Response(
      JSON.stringify({
        error: error.message,
        details: error.toString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);
