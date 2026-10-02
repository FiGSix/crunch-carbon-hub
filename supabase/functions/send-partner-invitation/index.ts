import "../_shared/sandbox.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const resendApiKey = Deno.env.get("RESEND_API_KEY") || "";

interface PartnerInvitationRequest {
  email: string;
  companyName: string;
  contactName?: string;
  environment: 'test' | 'live';
  scopes: string[];
  notes?: string;
  resend?: boolean;
  invitationId?: string;
}

/**
 * Generate a secure API key with appropriate prefix
 */
function generateApiKey(environment: 'test' | 'live'): string {
  const prefix = environment === 'live' ? 'cc_live_' : 'cc_test_';
  const body = crypto.randomUUID().replace(/-/g, '') + 
               crypto.randomUUID().replace(/-/g, '').substring(0, 16);
  return prefix + body;
}

/**
 * Hash an API key using SHA-256 for secure storage
 */
async function hashApiKey(apiKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(apiKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', keyData);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate the partner onboarding email HTML
 */
function generateEmailHtml(
  companyName: string, 
  contactName: string | undefined, 
  apiKey: string,
  scopes: string[],
  environment: 'test' | 'live'
): string {
  const greeting = contactName || 'Partner';
  const scopeList = scopes.length > 0 ? scopes.join(', ') : 'Full access';
  const envBadge = environment === 'live' 
    ? '<span style="background-color: #16a34a; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">LIVE</span>'
    : '<span style="background-color: #f59e0b; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">TEST</span>';

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to Crunch Carbon Partner API</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; line-height: 1.6; color: #333333; background-color: #f8f9fa;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f9fa; padding: 20px 0;">
        <tr>
          <td align="center" style="padding: 20px;">
            <table cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #F4C430 0%, #D4A017 100%); color: #1A1A1A; padding: 30px; text-align: center;">
                  <h1 style="margin: 0; font-size: 28px; font-weight: bold;">Welcome to Partner API 🚀</h1>
                  <p style="margin: 10px 0 0 0; font-size: 16px;">Your integration credentials are ready</p>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="background: #ffffff; padding: 30px;">
                  <p style="margin: 0 0 15px 0; font-size: 16px;">Hi ${greeting},</p>
                  
                  <p style="margin: 0 0 20px 0; font-size: 16px;">
                    Welcome to the <strong>Crunch Carbon Partner API</strong>! Your account for <strong>${companyName}</strong> has been set up and your API credentials are ready.
                  </p>
                  
                  <!-- API Key Box -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="background: #1a1a1a; border-radius: 8px; margin: 20px 0;">
                    <tr>
                      <td style="padding: 20px;">
                        <p style="margin: 0 0 10px 0; color: #9ca3af; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">
                          Your API Key ${envBadge}
                        </p>
                        <code style="display: block; background: #2d2d2d; padding: 15px; border-radius: 6px; color: #22c55e; font-family: 'Courier New', monospace; font-size: 14px; word-break: break-all;">
                          ${apiKey}
                        </code>
                        <p style="margin: 15px 0 0 0; color: #ef4444; font-size: 13px; font-weight: bold;">
                          ⚠️ Save this key now - it won't be shown again!
                        </p>
                      </td>
                    </tr>
                  </table>
                  
                  <!-- Quick Start -->
                  <h3 style="margin: 25px 0 15px 0; font-size: 18px; color: #1A1A1A;">Quick Start</h3>
                  
                  <table width="100%" cellpadding="0" cellspacing="0" style="background: #f9fafb; border-radius: 6px; margin: 0 0 20px 0;">
                    <tr>
                      <td style="padding: 20px;">
                        <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 13px;">Test your connection:</p>
                        <code style="display: block; background: #1a1a1a; padding: 15px; border-radius: 6px; color: #e5e7eb; font-family: 'Courier New', monospace; font-size: 13px; white-space: pre-wrap;">curl -X GET "https://uyjryuopuqgmsvayiccl.supabase.co/functions/v1/partner-api/v1/health" \\
  -H "X-API-Key: ${apiKey}"</code>
                      </td>
                    </tr>
                  </table>
                  
                  <!-- Resources -->
                  <h3 style="margin: 25px 0 15px 0; font-size: 18px; color: #1A1A1A;">Resources</h3>
                  
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding: 10px 0;">
                        <a href="https://uyjryuopuqgmsvayiccl.supabase.co/functions/v1/partner-api/v1/openapi.json" style="color: #2563eb; text-decoration: none; font-size: 15px;">📄 OpenAPI Specification</a>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 10px 0;">
                        <a href="https://uyjryuopuqgmsvayiccl.supabase.co/functions/v1/partner-api/v1/sdk-examples" style="color: #2563eb; text-decoration: none; font-size: 15px;">💻 SDK Examples (JS, Python, cURL)</a>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 10px 0;">
                        <a href="https://uyjryuopuqgmsvayiccl.supabase.co/functions/v1/partner-api/v1/health" style="color: #2563eb; text-decoration: none; font-size: 15px;">🔍 Health Check Endpoint</a>
                      </td>
                    </tr>
                  </table>
                  
                  <!-- Access Details -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="background: #FFF9E6; border-radius: 6px; margin: 25px 0;">
                    <tr>
                      <td style="padding: 20px;">
                        <h3 style="margin: 0 0 15px 0; font-size: 16px; color: #1A1A1A;">Your Access Details</h3>
                        <table width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <td style="padding: 5px 0; color: #6b7280; font-size: 14px; width: 40%;">Environment:</td>
                            <td style="padding: 5px 0; color: #1a1a1a; font-size: 14px; font-weight: 600;">${environment.toUpperCase()}</td>
                          </tr>
                          <tr>
                            <td style="padding: 5px 0; color: #6b7280; font-size: 14px;">Scopes:</td>
                            <td style="padding: 5px 0; color: #1a1a1a; font-size: 14px;">${scopeList}</td>
                          </tr>
                          <tr>
                            <td style="padding: 5px 0; color: #6b7280; font-size: 14px;">Rate Limit:</td>
                            <td style="padding: 5px 0; color: #1a1a1a; font-size: 14px;">100 req/min, 10,000 req/day</td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                  
                  <p style="margin: 20px 0 10px 0; font-size: 16px;">If you have any questions, please contact our integration support team.</p>
                  
                  <p style="margin: 25px 0 5px 0; font-size: 16px;">Best regards,</p>
                  <p style="margin: 0; font-size: 16px; font-weight: 600;">The Crunch Carbon Team</p>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
                  <p style="margin: 0; color: #6b7280; font-size: 12px;">
                    This is an automated email from Crunch Carbon Partner API.<br>
                    Please do not reply directly to this message.
                  </p>
                </td>
              </tr>
              
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("[send-partner-invitation] Request received:", req.method);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resendClient = new Resend(resendApiKey);

    // Verify admin authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("[send-partner-invitation] Missing authorization header");
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error("[send-partner-invitation] Authentication failed:", authError);
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[send-partner-invitation] User authenticated:", user.id);

    // Check if user is admin
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profileData || profileData.role !== 'admin') {
      console.error("[send-partner-invitation] Admin check failed:", { profileError, role: profileData?.role });
      return new Response(
        JSON.stringify({ error: "Admin privileges required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: PartnerInvitationRequest = await req.json();
    const { email, companyName, contactName, environment, scopes, notes, resend: isResend, invitationId } = body;

    console.log("[send-partner-invitation] Processing:", { email, companyName, environment, isResend });

    // Validate required fields
    if (!email || !email.includes("@")) {
      return new Response(
        JSON.stringify({ error: "Valid email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!companyName) {
      return new Response(
        JSON.stringify({ error: "Company name is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle resend case
    if (isResend && invitationId) {
      const { data: existingInvitation, error: invError } = await supabase
        .from('partner_invitations')
        .select('*')
        .eq('id', invitationId)
        .single();

      if (invError || !existingInvitation) {
        return new Response(
          JSON.stringify({ error: "Invitation not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Generate new API key for resend
      const apiKey = generateApiKey(existingInvitation.environment);
      const apiKeyHash = await hashApiKey(apiKey);
      const apiKeyPrefix = apiKey.substring(0, 12);

      // Get or create partner
      let partnerId = existingInvitation.partner_id;
      
      if (!partnerId) {
        // Create partner record
        const { data: newPartner, error: partnerError } = await supabase
          .from('partners')
          .insert({
            name: existingInvitation.company_name,
            contact_email: existingInvitation.email,
            is_active: true,
          })
          .select()
          .single();

        if (partnerError) {
          console.error("[send-partner-invitation] Failed to create partner:", partnerError);
          return new Response(
            JSON.stringify({ error: "Failed to create partner record" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        partnerId = newPartner.id;
      }

      // Deactivate old API keys
      await supabase
        .from('partner_api_keys')
        .update({ is_active: false })
        .eq('partner_id', partnerId);

      // Create new API key
      const { error: keyError } = await supabase
        .from('partner_api_keys')
        .insert({
          partner_id: partnerId,
          api_key_prefix: apiKeyPrefix,
          api_key_hash: apiKeyHash,
          environment: existingInvitation.environment,
          scopes: existingInvitation.requested_scopes,
          is_active: true,
        });

      if (keyError) {
        console.error("[send-partner-invitation] Failed to create API key:", keyError);
        return new Response(
          JSON.stringify({ error: "Failed to create API key" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update invitation
      const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await supabase
        .from('partner_invitations')
        .update({
          expires_at: newExpiresAt.toISOString(),
          partner_id: partnerId,
          invitation_token: crypto.randomUUID(),
        })
        .eq('id', invitationId);

      // Send email
      const emailHtml = generateEmailHtml(
        existingInvitation.company_name,
        existingInvitation.contact_name,
        apiKey,
        existingInvitation.requested_scopes || [],
        existingInvitation.environment
      );

      const emailResponse = await resendClient.emails.send({
        from: "Crunch Carbon <noreply@crunchcarbon.com>",
        to: [existingInvitation.email],
        subject: "Welcome to Crunch Carbon Partner API",
        html: emailHtml,
      });

      console.log("[send-partner-invitation] Resend email sent:", emailResponse);

      return new Response(
        JSON.stringify({
          success: true,
          message: `Invitation resent to ${existingInvitation.email}`,
          apiKey,
          apiKeyPrefix,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for existing pending invitation
    const { data: existingInvitation } = await supabase
      .from('partner_invitations')
      .select('id, status, expires_at')
      .eq('email', email)
      .eq('status', 'pending')
      .single();

    if (existingInvitation) {
      const isExpired = new Date(existingInvitation.expires_at) < new Date();
      if (!isExpired) {
        return new Response(
          JSON.stringify({ error: "An invitation has already been sent to this email" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      // Delete expired invitation
      await supabase.from('partner_invitations').delete().eq('id', existingInvitation.id);
    }

    // Check if partner already exists with this email
    const { data: existingPartner } = await supabase
      .from('partners')
      .select('id')
      .eq('contact_email', email)
      .single();

    if (existingPartner) {
      return new Response(
        JSON.stringify({ error: "A partner with this email already exists" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate API key and invitation token
    const apiKey = generateApiKey(environment);
    const apiKeyHash = await hashApiKey(apiKey);
    const apiKeyPrefix = apiKey.substring(0, 12);
    const invitationToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Create partner record
    const { data: partner, error: partnerError } = await supabase
      .from('partners')
      .insert({
        name: companyName,
        contact_email: email,
        is_active: true,
      })
      .select()
      .single();

    if (partnerError) {
      console.error("[send-partner-invitation] Failed to create partner:", partnerError);
      return new Response(
        JSON.stringify({ error: "Failed to create partner record" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create API key record
    const { error: keyError } = await supabase
      .from('partner_api_keys')
      .insert({
        partner_id: partner.id,
        api_key_prefix: apiKeyPrefix,
        api_key_hash: apiKeyHash,
        environment,
        scopes: scopes,
        is_active: true,
      });

    if (keyError) {
      console.error("[send-partner-invitation] Failed to create API key:", keyError);
      // Rollback partner creation
      await supabase.from('partners').delete().eq('id', partner.id);
      return new Response(
        JSON.stringify({ error: "Failed to create API key" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create invitation record
    const { data: invitation, error: invitationError } = await supabase
      .from('partner_invitations')
      .insert({
        email,
        company_name: companyName,
        contact_name: contactName,
        invitation_token: invitationToken,
        status: 'pending',
        requested_scopes: scopes,
        environment,
        notes,
        invited_by: user.id,
        expires_at: expiresAt.toISOString(),
        partner_id: partner.id,
      })
      .select()
      .single();

    if (invitationError) {
      console.error("[send-partner-invitation] Failed to create invitation:", invitationError);
      return new Response(
        JSON.stringify({ error: "Failed to create invitation record" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send onboarding email
    const emailHtml = generateEmailHtml(companyName, contactName, apiKey, scopes, environment);

    const emailResponse = await resendClient.emails.send({
      from: "Crunch Carbon <noreply@crunchcarbon.com>",
      to: [email],
      subject: "Welcome to Crunch Carbon Partner API",
      html: emailHtml,
    });

    console.log("[send-partner-invitation] Email sent:", emailResponse);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Partner invitation sent to ${email}`,
        invitation: {
          id: invitation.id,
          email,
          companyName,
          environment,
          expiresAt: expiresAt.toISOString(),
        },
        apiKey,
        apiKeyPrefix,
        partnerId: partner.id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[send-partner-invitation] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
