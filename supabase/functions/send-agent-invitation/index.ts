import { isTestAccount, sandboxRefusal } from "../_shared/sandbox.ts";
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
  target_company_id?: string | null;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resendClient = new Resend(resendApiKey);

    // Verify admin authentication
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

    if (await isTestAccount(supabase, user.id)) return sandboxRefusal(corsHeaders);

    // Check if user is admin by querying profiles directly
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    console.log("User role check:", { userId: user.id, role: profileData?.role, error: profileError });

    const callerRole = profileData?.role;
    if (profileError || !profileData || (callerRole !== 'admin' && callerRole !== 'super_partner')) {
      console.error("Role check failed:", { profileError, profileData });
      return new Response(
        JSON.stringify({ error: "Admin or super partner privileges required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get admin's company (if they belong to one)
    const { data: adminCompany } = await supabase
      .from('company_members')
      .select('company_id, companies(company_name, email_domain)')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    console.log("Admin company:", adminCompany);

    const { email, firstName, lastName, companyName, resend, target_company_id: bodyTargetCompanyId }: InvitationRequest = await req.json();

    // Super partners can only invite into companies linked to them; validate ownership
    let effectiveTargetCompanyId: string | null = bodyTargetCompanyId ?? null;
    if (callerRole === 'super_partner') {
      if (!effectiveTargetCompanyId) {
        return new Response(
          JSON.stringify({ error: "Super partners must specify target_company_id from a linked company" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const { data: ownedCompany } = await supabase
        .from('companies')
        .select('id')
        .eq('id', effectiveTargetCompanyId)
        .eq('super_partner_id', user.id)
        .maybeSingle();
      if (!ownedCompany) {
        return new Response(
          JSON.stringify({ error: "Target company is not linked to your Super Partner account" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    console.log("Processing invitation for:", email, "Resend:", resend);

    // Validate email
    if (!email || !email.includes("@")) {
      console.error("Invalid email format:", email);
      return new Response(
        JSON.stringify({ error: "Valid email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if invitation already exists
    const { data: existingInvitation, error: invitationCheckError } = await supabase
      .from("agent_invitations")
      .select("id, status, expires_at, invitation_token")
      .eq("email", email)
      .single();

    console.log("Existing invitation check:", { exists: !!existingInvitation, status: existingInvitation?.status, expiresAt: existingInvitation?.expires_at });

    // Handle resend mode
    if (resend) {
      if (!existingInvitation || existingInvitation.status !== 'pending') {
        return new Response(
          JSON.stringify({ error: "No pending invitation found to resend" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Use existing token
      const invitationToken = existingInvitation.invitation_token;
      
      // Update expiry date
      const newExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
      await supabase
        .from("agent_invitations")
        .update({ expires_at: newExpiresAt.toISOString() })
        .eq("id", existingInvitation.id);

      // Generate registration link using production domain
      const registrationLink = `https://crunchcarbon.com/register?role=agent&token=${invitationToken}`;

      console.log("Resending invitation email to:", email);

      // Send invitation email
      const emailResponse = await resendClient.emails.send({
        from: "CrunchCarbon <noreply@crunchcarbon.com>",
        to: [email],
        subject: "You're Invited to Join CrunchCarbon as an Agent",
        html: `
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
                  <table cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); box-sizing: border-box;">
                    
                    <!-- Header -->
                    <tr>
                      <td style="background: linear-gradient(135deg, #F4C430 0%, #D4A017 100%); color: #1A1A1A; padding: 30px; text-align: center;">
                        <h1 style="margin: 0; font-size: 28px; font-weight: bold;">You're Invited! 🎉</h1>
                      </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                      <td style="background: #ffffff; padding: 30px;">
                        <p style="margin: 0 0 15px 0; font-size: 16px; color: #333333;">Hi ${firstName || 'there'},</p>
                        
                        <p style="margin: 0 0 20px 0; font-size: 16px; color: #333333;">You've been invited to join <strong>CrunchCarbon</strong> as an Agent Partner!</p>
                        
                        <!-- Benefits Box -->
                        <table width="100%" cellpadding="0" cellspacing="0" style="background: #FFF9E6; border-radius: 6px; margin: 20px 0;">
                          <tr>
                            <td style="padding: 20px;">
                              <h3 style="margin: 0 0 15px 0; font-size: 18px; color: #1A1A1A;">As an agent, you'll be able to:</h3>
                              <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                  <td style="padding: 8px 0; padding-left: 25px; position: relative; font-size: 15px; color: #333333;">
                                    <span style="position: absolute; left: 0; color: #F4C430; font-weight: bold;">✓</span>
                                    Create carbon credit proposals in minutes
                                  </td>
                                </tr>
                                <tr>
                                  <td style="padding: 8px 0; padding-left: 25px; position: relative; font-size: 15px; color: #333333;">
                                    <span style="position: absolute; left: 0; color: #F4C430; font-weight: bold;">✓</span>
                                    Manage your client portfolio
                                  </td>
                                </tr>
                                <tr>
                                  <td style="padding: 8px 0; padding-left: 25px; position: relative; font-size: 15px; color: #333333;">
                                    <span style="position: absolute; left: 0; color: #F4C430; font-weight: bold;">✓</span>
                                    Earn commission on successful projects
                                  </td>
                                </tr>
                                <tr>
                                  <td style="padding: 8px 0; padding-left: 25px; position: relative; font-size: 15px; color: #333333;">
                                    <span style="position: absolute; left: 0; color: #F4C430; font-weight: bold;">✓</span>
                                    Track project onboarding and audit status
                                  </td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                        </table>
                        
                        <p style="margin: 0 0 10px 0; font-size: 16px; color: #333333;">Click the button below to complete your registration:</p>
                        
                        <!-- Button -->
                        <table width="100%" cellpadding="0" cellspacing="0" style="margin: 20px 0;">
                          <tr>
                            <td align="center">
                              <a href="${registrationLink}" style="display: inline-block; background: linear-gradient(135deg, #F4C430 0%, #D4A017 100%); color: #1A1A1A; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; box-shadow: 0 4px 6px rgba(244, 196, 48, 0.3); font-size: 16px;">Accept Invitation</a>
                            </td>
                          </tr>
                        </table>
                        
                        <p style="margin: 20px 0 10px 0; color: #dc2626; font-weight: bold; font-size: 15px;">⏰ This invitation expires in 48 hours.</p>
                        
                        <p style="margin: 0 0 10px 0; font-size: 16px; color: #333333;">If you have any questions, feel free to reply to this email.</p>
                        
                        <p style="margin: 25px 0 5px 0; font-size: 16px; color: #333333;">Best regards,</p>
                        <p style="margin: 0; font-size: 16px; color: #333333; font-weight: 600;">The CrunchCarbon Team</p>
                      </td>
                    </tr>
                    
                    <!-- Footer -->
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
        `,
      });

      console.log("Invitation email resent:", emailResponse);

      return new Response(
        JSON.stringify({
          success: true,
          message: `Invitation resent to ${email}`,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (existingInvitation) {
      const isActivePending = existingInvitation.status === 'pending' && new Date(existingInvitation.expires_at) >= new Date();

      if (isActivePending) {
        console.log("Duplicate invitation attempt (still valid):", email);
        return new Response(
          JSON.stringify({ error: "An invitation has already been sent to this email. Please check your inbox or wait for it to expire." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Stale invitation (expired, accepted, or pending-but-past-expiry) — delete to allow re-invite
      console.log("Removing stale invitation (status:", existingInvitation.status, ") for:", email);
      const { error: deleteError } = await supabase
        .from("agent_invitations")
        .delete()
        .eq("id", existingInvitation.id);

      if (deleteError) {
        console.error("Failed to delete stale invitation:", deleteError);
      }
    }

    // Check if user already exists with this email
    const { data: existingProfile, error: profileCheckError } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email)
      .single();

    console.log("Existing profile check:", { exists: !!existingProfile, error: profileCheckError });

    if (existingProfile) {
      console.log("User already exists:", email);
      return new Response(
        JSON.stringify({ error: "A user with this email already exists" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate secure invitation token
    const invitationToken = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, '');
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

    console.log("Creating invitation record for:", email);

    // Insert invitation into database
    const { data: invitation, error: invitationError } = await supabase
      .from("agent_invitations")
      .insert({
        email,
        first_name: firstName,
        last_name: lastName,
        company_name: companyName || adminCompany?.companies?.company_name,
        company_id: adminCompany?.company_id || null,
        invitation_token: invitationToken,
        expires_at: expiresAt.toISOString(),
        invited_by: user.id,
        target_company_id: effectiveTargetCompanyId,
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

    // Generate registration link using production domain
    const registrationLink = `https://crunchcarbon.com/register?role=agent&token=${invitationToken}`;

    console.log("Sending invitation email to:", email);

    // Send invitation email
    const emailResponse = await resendClient.emails.send({
      from: "CrunchCarbon <noreply@crunchcarbon.com>",
      to: [email],
      subject: "You're Invited to Join CrunchCarbon as an Agent",
      html: `
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
                <table cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); box-sizing: border-box;">
                  
                  <!-- Header -->
                  <tr>
                    <td style="background: linear-gradient(135deg, #F4C430 0%, #D4A017 100%); color: #1A1A1A; padding: 30px; text-align: center;">
                      <h1 style="margin: 0; font-size: 28px; font-weight: bold;">You're Invited! 🎉</h1>
                    </td>
                  </tr>
                  
                  <!-- Content -->
                  <tr>
                    <td style="background: #ffffff; padding: 30px;">
                      <p style="margin: 0 0 15px 0; font-size: 16px; color: #333333;">Hi ${firstName || 'there'},</p>
                      
                      <p style="margin: 0 0 20px 0; font-size: 16px; color: #333333;">You've been invited to join <strong>CrunchCarbon</strong> as an Agent Partner!</p>
                      
                      <!-- Benefits Box -->
                      <table width="100%" cellpadding="0" cellspacing="0" style="background: #FFF9E6; border-radius: 6px; margin: 20px 0;">
                        <tr>
                          <td style="padding: 20px;">
                            <h3 style="margin: 0 0 15px 0; font-size: 18px; color: #1A1A1A;">As an agent, you'll be able to:</h3>
                            <table width="100%" cellpadding="0" cellspacing="0">
                              <tr>
                                <td style="padding: 8px 0; padding-left: 25px; position: relative; font-size: 15px; color: #333333;">
                                  <span style="position: absolute; left: 0; color: #F4C430; font-weight: bold;">✓</span>
                                  Create carbon credit proposals in minutes
                                </td>
                              </tr>
                              <tr>
                                <td style="padding: 8px 0; padding-left: 25px; position: relative; font-size: 15px; color: #333333;">
                                  <span style="position: absolute; left: 0; color: #F4C430; font-weight: bold;">✓</span>
                                  Manage your client portfolio
                                </td>
                              </tr>
                              <tr>
                                <td style="padding: 8px 0; padding-left: 25px; position: relative; font-size: 15px; color: #333333;">
                                  <span style="position: absolute; left: 0; color: #F4C430; font-weight: bold;">✓</span>
                                  Earn commission on successful projects
                                </td>
                              </tr>
                              <tr>
                                <td style="padding: 8px 0; padding-left: 25px; position: relative; font-size: 15px; color: #333333;">
                                  <span style="position: absolute; left: 0; color: #F4C430; font-weight: bold;">✓</span>
                                  Track project onboarding and audit status
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                      
                      <p style="margin: 0 0 10px 0; font-size: 16px; color: #333333;">Click the button below to complete your registration:</p>
                      
                      <!-- Button -->
                      <table width="100%" cellpadding="0" cellspacing="0" style="margin: 20px 0;">
                        <tr>
                          <td align="center">
                            <a href="${registrationLink}" style="display: inline-block; background: linear-gradient(135deg, #F4C430 0%, #D4A017 100%); color: #1A1A1A; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; box-shadow: 0 4px 6px rgba(244, 196, 48, 0.3); font-size: 16px;">Accept Invitation</a>
                          </td>
                        </tr>
                      </table>
                      
                      <p style="margin: 20px 0 10px 0; color: #dc2626; font-weight: bold; font-size: 15px;">⏰ This invitation expires in 48 hours.</p>
                      
                      <p style="margin: 0 0 10px 0; font-size: 16px; color: #333333;">If you have any questions, feel free to reply to this email.</p>
                      
                      <p style="margin: 25px 0 5px 0; font-size: 16px; color: #333333;">Best regards,</p>
                      <p style="margin: 0; font-size: 16px; color: #333333; font-weight: 600;">The CrunchCarbon Team</p>
                    </td>
                  </tr>
                  
                  <!-- Footer -->
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
      `,
    });

    console.log("Invitation email sent:", emailResponse);

    return new Response(
      JSON.stringify({
        success: true,
        invitation,
        message: `Invitation sent to ${email}`,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in send-agent-invitation:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);
