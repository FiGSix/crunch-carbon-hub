import "../_shared/sandbox.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ClientTeamInvitationRequest {
  email: string;
  firstName?: string;
  lastName?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("❌ No authorization header");
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get the user from the auth header
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      console.error("❌ Auth error:", userError);
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("✅ User authenticated:", user.id);

    // Get user's client company membership
    const { data: membership, error: membershipError } = await supabase
      .from("client_company_members")
      .select("client_company_id, role, status")
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();

    if (membershipError || !membership) {
      console.error("❌ Membership fetch error:", membershipError);
      return new Response(
        JSON.stringify({ success: false, error: "User is not part of any client company" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if user is an account admin
    if (membership.role !== "account_admin") {
      console.error("❌ Authorization failed: Not an account admin");
      return new Response(
        JSON.stringify({ success: false, error: "Only account admins can send invitations" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get company details
    const { data: company, error: companyError } = await supabase
      .from("client_companies")
      .select("company_name")
      .eq("id", membership.client_company_id)
      .single();

    if (companyError || !company) {
      console.error("Company fetch error:", companyError);
      throw new Error("Company not found");
    }

    console.log("✅ Company found:", company.company_name);

    const { email, firstName, lastName }: ClientTeamInvitationRequest = await req.json();

    // Validate email
    if (!email || !email.includes("@")) {
      console.error("❌ Invalid email:", email);
      return new Response(
        JSON.stringify({ success: false, error: "Valid email is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if user with this email already exists
    const { data: existingUser } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", normalizedEmail)
      .single();

    if (existingUser) {
      console.error("❌ User already exists:", normalizedEmail);
      return new Response(
        JSON.stringify({ success: false, error: "A user with this email already exists" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if there's already a pending invitation for this email to this company
    const { data: existingInvitation } = await supabase
      .from("client_team_invitations")
      .select("id")
      .eq("email", normalizedEmail)
      .eq("client_company_id", membership.client_company_id)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .single();

    if (existingInvitation) {
      console.error("❌ Invitation already sent:", normalizedEmail);
      return new Response(
        JSON.stringify({ success: false, error: "An invitation has already been sent to this email" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Generate secure invitation token
    const invitationToken = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, "");
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 48); // 48 hours expiry

    // Create client team invitation
    const { data: invitation, error: invitationError } = await supabase
      .from("client_team_invitations")
      .insert({
        email: normalizedEmail,
        first_name: firstName || null,
        last_name: lastName || null,
        client_company_id: membership.client_company_id,
        invitation_token: invitationToken,
        invited_by: user.id,
        status: "pending",
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (invitationError) {
      console.error("❌ Invitation creation error:", invitationError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to create invitation" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("✅ Invitation created:", invitation.id);

    // Get inviter's name
    const { data: inviterProfile } = await supabase
      .from("profiles")
      .select("first_name, last_name")
      .eq("id", user.id)
      .single();

    const inviterName = inviterProfile
      ? `${inviterProfile.first_name || ""} ${inviterProfile.last_name || ""}`.trim()
      : "A team member";

    // Create registration link with client team invitation token
    const registrationUrl = `${Deno.env.get("APP_URL") || "https://crunchcarbon.com"}/register?client_team_token=${invitationToken}`;

    // Send email invitation
    const emailResponse = await resend.emails.send({
      from: "CrunchCarbon <team@crunchcarbon.com>",
      to: [email],
      subject: `You've been invited to join ${company.company_name} on CrunchCarbon`,
      html: `
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Team Invitation</title>
          </head>
          <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8f9fa;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f9fa; padding: 20px 0;">
              <tr>
                <td align="center" style="padding: 20px;">
                  <table cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); box-sizing: border-box;">
                    
                    <!-- Header -->
                    <tr>
                      <td style="background: linear-gradient(135deg, #FFCD03 0%, #F59E0B 100%); color: #1a1a1a; padding: 30px; text-align: center;">
                        <h1 style="margin: 0; font-size: 28px; font-weight: bold;">Team Invitation</h1>
                      </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                      <td style="background: #ffffff; padding: 30px;">
                        <p style="margin: 0 0 15px 0; font-size: 16px; color: #333333; line-height: 1.6;">Hi${firstName ? ` ${firstName}` : ""},</p>
                        
                        <p style="margin: 0 0 20px 0; font-size: 16px; color: #333333; line-height: 1.6;"><strong>${inviterName}</strong> has invited you to join <strong>${company.company_name}</strong> on CrunchCarbon.</p>
                        
                        <p style="margin: 0 0 10px 0; font-size: 16px; color: #333333; line-height: 1.6;">As part of the team, you'll be able to:</p>
                        <table width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <td style="padding: 5px 0 5px 20px; font-size: 15px; color: #333333;">• View and track your company's solar projects</td>
                          </tr>
                          <tr>
                            <td style="padding: 5px 0 5px 20px; font-size: 15px; color: #333333;">• Upload onboarding documents</td>
                          </tr>
                          <tr>
                            <td style="padding: 5px 0 5px 20px; font-size: 15px; color: #333333;">• Monitor carbon credit revenue</td>
                          </tr>
                          <tr>
                            <td style="padding: 5px 0 5px 20px; font-size: 15px; color: #333333;">• Collaborate with team members</td>
                          </tr>
                        </table>
                        
                        <!-- Button -->
                        <table width="100%" cellpadding="0" cellspacing="0" style="margin: 20px 0;">
                          <tr>
                            <td align="center">
                              <a href="${registrationUrl}" style="display: inline-block; background: linear-gradient(135deg, #FFCD03 0%, #F59E0B 100%); color: #1a1a1a; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(255, 205, 3, 0.3);">Accept Invitation & Sign Up</a>
                            </td>
                          </tr>
                        </table>
                        
                        <!-- Expiry Notice -->
                        <table width="100%" cellpadding="0" cellspacing="0" style="background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px; margin: 20px 0;">
                          <tr>
                            <td style="padding: 12px;">
                              <p style="margin: 0; font-size: 14px; color: #333333;">⏰ <strong>Note:</strong> This invitation expires in 48 hours</p>
                            </td>
                          </tr>
                        </table>
                        
                        <p style="font-size: 14px; color: #6b7280; margin: 20px 0 0 0; line-height: 1.6;">
                          If you're unable to click the button, copy and paste this link into your browser:<br/>
                          <a href="${registrationUrl}" style="color: #F59E0B; word-break: break-all; text-decoration: underline;">${registrationUrl}</a>
                        </p>
                      </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                      <td style="background: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
                        <p style="margin: 0 0 10px 0; font-size: 14px; color: #6b7280;">
                          If you didn't expect this invitation, you can safely ignore this email.
                        </p>
                        <p style="margin: 0; font-size: 14px; color: #6b7280;">
                          Questions? Contact us at support@crunchcarbon.com
                        </p>
                      </td>
                    </tr>
                    
                  </table>
                </td>
              </tr>
            </table>
          </body>
        </html>
      `,
    });

    console.log("✅ Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Team invitation sent successfully",
        invitation: {
          id: invitation.id,
          email: invitation.email,
          expiresAt: invitation.expires_at,
        },
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("❌ Unexpected error in send-client-team-invitation:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "An unexpected error occurred while sending the invitation",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
