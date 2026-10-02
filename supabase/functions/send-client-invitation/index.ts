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

interface InvitationRequest {
  email: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  resend?: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resendClient = new Resend(resendApiKey);

    // Verify authentication (any authenticated user can invite)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error("Authentication failed:", authError);
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("User authenticated:", user.id);

    const { email, firstName, lastName, companyName, resend: isResend }: InvitationRequest = await req.json();

    console.log("Processing client invitation for:", email, "Resend:", isResend);

    // Validate email
    if (!email || !email.includes("@")) {
      return new Response(
        JSON.stringify({ error: "Valid email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if invitation already exists
    const { data: existingInvitation } = await supabase
      .from("client_invitations")
      .select("id, status, expires_at, invitation_token")
      .eq("email", email)
      .single();

    // Handle resend mode
    if (isResend) {
      if (!existingInvitation || existingInvitation.status !== 'pending') {
        return new Response(
          JSON.stringify({ error: "No pending invitation found to resend" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const invitationToken = existingInvitation.invitation_token;
      const newExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
      await supabase
        .from("client_invitations")
        .update({ expires_at: newExpiresAt.toISOString() })
        .eq("id", existingInvitation.id);

      const registrationLink = `https://crunchcarbon.com/register?role=client&token=${invitationToken}`;

      await resendClient.emails.send({
        from: "CrunchCarbon <noreply@crunchcarbon.com>",
        to: [email],
        subject: "You're Invited to Join CrunchCarbon",
        html: buildClientEmailHtml(firstName, registrationLink),
      });

      return new Response(
        JSON.stringify({ success: true, message: `Invitation resent to ${email}` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Block duplicate pending invitations
    if (existingInvitation && existingInvitation.status === 'pending') {
      const isExpired = new Date(existingInvitation.expires_at) < new Date();
      if (!isExpired) {
        return new Response(
          JSON.stringify({ error: "An invitation has already been sent to this email." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        // Delete expired invitation
        await supabase.from("client_invitations").delete().eq("id", existingInvitation.id);
      }
    }

    // Check if user already exists
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email)
      .single();

    if (existingProfile) {
      return new Response(
        JSON.stringify({ error: "A user with this email already exists" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate secure invitation token
    const invitationToken = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, '');
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

    // Insert invitation
    const { data: invitation, error: invitationError } = await supabase
      .from("client_invitations")
      .insert({
        email,
        first_name: firstName || null,
        last_name: lastName || null,
        company_name: companyName || null,
        invitation_token: invitationToken,
        expires_at: expiresAt.toISOString(),
        invited_by: user.id,
      })
      .select()
      .single();

    if (invitationError) {
      console.error("Error creating invitation:", invitationError);
      return new Response(
        JSON.stringify({ error: "Failed to create invitation" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const registrationLink = `https://crunchcarbon.com/register?role=client&token=${invitationToken}`;

    await resendClient.emails.send({
      from: "CrunchCarbon <noreply@crunchcarbon.com>",
      to: [email],
      subject: "You're Invited to Join CrunchCarbon",
      html: buildClientEmailHtml(firstName, registrationLink),
    });

    console.log("Client invitation sent to:", email);

    return new Response(
      JSON.stringify({ success: true, invitation, message: `Invitation sent to ${email}` }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in send-client-invitation:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

function buildClientEmailHtml(firstName: string | undefined, registrationLink: string): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>You're Invited to CrunchCarbon</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; line-height: 1.6; color: #333333; background-color: #f8f9fa;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f9fa; padding: 20px 0;">
        <tr>
          <td align="center" style="padding: 20px;">
            <table cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              <tr>
                <td style="background: linear-gradient(135deg, #F4C430 0%, #D4A017 100%); color: #1A1A1A; padding: 30px; text-align: center;">
                  <h1 style="margin: 0; font-size: 28px; font-weight: bold;">You're Invited! 🎉</h1>
                </td>
              </tr>
              <tr>
                <td style="background: #ffffff; padding: 30px;">
                  <p style="margin: 0 0 15px 0; font-size: 16px;">Hi ${firstName || 'there'},</p>
                  <p style="margin: 0 0 20px 0; font-size: 16px;">You've been invited to join <strong>CrunchCarbon</strong> — the easiest way to monetise your solar system through carbon credits!</p>
                  <table width="100%" cellpadding="0" cellspacing="0" style="background: #FFF9E6; border-radius: 6px; margin: 20px 0;">
                    <tr>
                      <td style="padding: 20px;">
                        <h3 style="margin: 0 0 15px 0; font-size: 18px; color: #1A1A1A;">Here's what you'll get:</h3>
                        <table width="100%" cellpadding="0" cellspacing="0">
                          <tr><td style="padding: 8px 0; padding-left: 25px; position: relative; font-size: 15px;"><span style="position: absolute; left: 0; color: #F4C430; font-weight: bold;">✓</span>Monetise your solar system through carbon credits</td></tr>
                          <tr><td style="padding: 8px 0; padding-left: 25px; position: relative; font-size: 15px;"><span style="position: absolute; left: 0; color: #F4C430; font-weight: bold;">✓</span>Earn passive income — completely free to join</td></tr>
                          <tr><td style="padding: 8px 0; padding-left: 25px; position: relative; font-size: 15px;"><span style="position: absolute; left: 0; color: #F4C430; font-weight: bold;">✓</span>Track your projects and credits in real time</td></tr>
                          <tr><td style="padding: 8px 0; padding-left: 25px; position: relative; font-size: 15px;"><span style="position: absolute; left: 0; color: #F4C430; font-weight: bold;">✓</span>Simple onboarding — get started in minutes</td></tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                  <p style="margin: 0 0 10px 0; font-size: 16px;">Click below to create your account:</p>
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin: 20px 0;">
                    <tr>
                      <td align="center">
                        <a href="${registrationLink}" style="display: inline-block; background: linear-gradient(135deg, #F4C430 0%, #D4A017 100%); color: #1A1A1A; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; box-shadow: 0 4px 6px rgba(244, 196, 48, 0.3); font-size: 16px;">Accept Invitation</a>
                      </td>
                    </tr>
                  </table>
                  <p style="margin: 20px 0 10px 0; color: #dc2626; font-weight: bold; font-size: 15px;">⏰ This invitation expires in 48 hours.</p>
                  <p style="margin: 0 0 10px 0; font-size: 16px;">If you have any questions, feel free to reply to this email.</p>
                  <p style="margin: 25px 0 5px 0; font-size: 16px;">Best regards,</p>
                  <p style="margin: 0; font-size: 16px; font-weight: 600;">The CrunchCarbon Team</p>
                </td>
              </tr>
              <tr>
                <td style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
                  <p style="margin: 0; color: #6b7280; font-size: 14px;">This is an automated email. Please do not reply directly to this message.</p>
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

serve(handler);
