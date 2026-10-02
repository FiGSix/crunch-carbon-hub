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

interface ApprovalEmailRequest {
  agentId: string;
  agentEmail: string;
  agentFirstName?: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("send-agent-approval-email function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resendClient = new Resend(resendApiKey);

    // Verify admin authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("Missing authorization header");
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

    // Check if user is admin
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profileData || profileData.role !== 'admin') {
      console.error("Admin check failed:", { profileError, profileData });
      return new Response(
        JSON.stringify({ error: "Admin privileges required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { agentId, agentEmail, agentFirstName }: ApprovalEmailRequest = await req.json();

    console.log("Sending approval email to agent:", { agentId, agentEmail, agentFirstName });

    if (!agentEmail) {
      console.error("Missing agent email");
      return new Response(
        JSON.stringify({ error: "Agent email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const loginLink = "https://crunchcarbon.com/login";

    // Send approval email
    const emailResponse = await resendClient.emails.send({
      from: "CrunchCarbon <noreply@crunchcarbon.com>",
      to: [agentEmail],
      subject: "Your CrunchCarbon Agent Account Has Been Approved! 🎉",
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Account Approved - CrunchCarbon</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; line-height: 1.6; color: #333333; background-color: #f8f9fa;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f9fa; padding: 20px 0;">
            <tr>
              <td align="center" style="padding: 20px;">
                <table cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); box-sizing: border-box;">
                  
                  <!-- Header -->
                  <tr>
                    <td style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: #ffffff; padding: 30px; text-align: center;">
                      <h1 style="margin: 0; font-size: 28px; font-weight: bold;">Account Approved! 🎉</h1>
                    </td>
                  </tr>
                  
                  <!-- Content -->
                  <tr>
                    <td style="background: #ffffff; padding: 30px;">
                      <p style="margin: 0 0 15px 0; font-size: 16px; color: #333333;">Hi ${agentFirstName || 'there'},</p>
                      
                      <p style="margin: 0 0 20px 0; font-size: 16px; color: #333333;">Great news! Your <strong>CrunchCarbon</strong> agent account has been approved and is now fully active.</p>
                      
                      <!-- What's Next Box -->
                      <table width="100%" cellpadding="0" cellspacing="0" style="background: #ECFDF5; border-radius: 6px; margin: 20px 0; border-left: 4px solid #10B981;">
                        <tr>
                          <td style="padding: 20px;">
                            <h3 style="margin: 0 0 15px 0; font-size: 18px; color: #1A1A1A;">What you can do now:</h3>
                            <table width="100%" cellpadding="0" cellspacing="0">
                              <tr>
                                <td style="padding: 8px 0; padding-left: 25px; position: relative; font-size: 15px; color: #333333;">
                                  <span style="position: absolute; left: 0; color: #10B981; font-weight: bold;">✓</span>
                                  Create carbon credit proposals for your clients
                                </td>
                              </tr>
                              <tr>
                                <td style="padding: 8px 0; padding-left: 25px; position: relative; font-size: 15px; color: #333333;">
                                  <span style="position: absolute; left: 0; color: #10B981; font-weight: bold;">✓</span>
                                  Add and manage your client portfolio
                                </td>
                              </tr>
                              <tr>
                                <td style="padding: 8px 0; padding-left: 25px; position: relative; font-size: 15px; color: #333333;">
                                  <span style="position: absolute; left: 0; color: #10B981; font-weight: bold;">✓</span>
                                  Track projects through onboarding and audit stages
                                </td>
                              </tr>
                              <tr>
                                <td style="padding: 8px 0; padding-left: 25px; position: relative; font-size: 15px; color: #333333;">
                                  <span style="position: absolute; left: 0; color: #10B981; font-weight: bold;">✓</span>
                                  Access your agent dashboard and analytics
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                      
                      <p style="margin: 0 0 10px 0; font-size: 16px; color: #333333;">Log in to your account to get started:</p>
                      
                      <!-- Button -->
                      <table width="100%" cellpadding="0" cellspacing="0" style="margin: 20px 0;">
                        <tr>
                          <td align="center">
                            <a href="${loginLink}" style="display: inline-block; background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; box-shadow: 0 4px 6px rgba(16, 185, 129, 0.3); font-size: 16px;">Go to Dashboard</a>
                          </td>
                        </tr>
                      </table>
                      
                      <p style="margin: 20px 0 10px 0; font-size: 16px; color: #333333;">If you have any questions or need assistance getting started, feel free to reply to this email.</p>
                      
                      <p style="margin: 25px 0 5px 0; font-size: 16px; color: #333333;">Welcome aboard!</p>
                      <p style="margin: 0; font-size: 16px; color: #333333; font-weight: 600;">The CrunchCarbon Team</p>
                    </td>
                  </tr>
                  
                  <!-- Footer -->
                  <tr>
                    <td style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
                      <p style="margin: 0; color: #6b7280; font-size: 14px;">© ${new Date().getFullYear()} CrunchCarbon. All rights reserved.</p>
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

    console.log("Approval email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Approval email sent to ${agentEmail}`,
        emailId: emailResponse.data?.id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error: any) {
    console.error("Error in send-agent-approval-email:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to send approval email" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);
