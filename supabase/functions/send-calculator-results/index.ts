import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CalculatorRequest {
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  companyName?: string;
  systemSizeKwp: number;
  commissioningDate: string;
  referralCode?: string;
  ipAddress?: string;
  userAgent?: string;
  address?: string;
  addressLat?: number;
  addressLng?: number;
  province?: string;
  segment?: string;
  sendEmail?: boolean;
}


interface CalculatorSuccessResponse {
  success: true;
  proposalId: string;
  token: string;
  message: string;
  emailDelivered: boolean;
}

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

// National fallback yield (kWh/kWp/year)
const DEFAULT_ANNUAL_GENERATION_FACTOR = 1642.50;
const DEFAULT_CARBON_FACTOR = 1.0334; // tCO₂/MWh

function getClientSharePercentage(portfolioKWp: number): number {
  if (portfolioKWp < 5000) return 60.20;
  if (portfolioKWp < 10000) return 63;
  if (portfolioKWp < 20000) return 66.5;
  if (portfolioKWp < 30000) return 68.25;
  return 70;
}

const SA_PROVINCES = new Set([
  "Eastern Cape", "Free State", "Gauteng", "KwaZulu-Natal", "Limpopo",
  "Mpumalanga", "Northern Cape", "North West", "Western Cape",
]);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const requestBody = await req.json() as CalculatorRequest;
    const {
      email,
      name,
      firstName: rawFirstName,
      lastName: rawLastName,
      phone,
      companyName,
      systemSizeKwp,
      commissioningDate,
      referralCode,
      ipAddress,
      userAgent,
      address,
      addressLat,
      addressLng,
      province,
      segment,
      sendEmail,
    } = requestBody;

    const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
    const normalizedEmail = typeof email === "string" ? email.toLowerCase().trim() : "";
    const normalizedName = str(name);
    const normalizedSize = Number(systemSizeKwp);
    const parsedCommissioningDate = new Date(`${commissioningDate}T00:00:00Z`);
    const minimumCommissioningDate = new Date("2022-09-15T00:00:00Z");
    const maximumCommissioningDate = new Date("2030-12-31T00:00:00Z");

    // Explicit first/last name is preferred; a single "name" stays supported for older callers.
    const nameParts = normalizedName.split(/\s+/).filter(Boolean);
    const firstName = str(rawFirstName) || nameParts[0] || '';
    const lastName = str(rawLastName) || nameParts.slice(1).join(' ') || '';
    const normalizedPhone = str(phone);
    const normalizedCompany = str(companyName);
    const normalizedAddress = str(address);
    const shouldSendEmail = sendEmail !== false;

    // Validate inputs
    if (!normalizedEmail || !firstName || !commissioningDate) {
      return jsonResponse({ error: "Please complete your name, email, and commissioning date.", code: "INVALID_INPUT" }, 400);
    }
    if (!Number.isFinite(normalizedSize) || normalizedSize <= 0 || normalizedSize > 15000) {
      return jsonResponse({ error: "System size must be between 0 and 15,000 kWp.", code: "INVALID_SYSTEM_SIZE" }, 400);
    }
    if (
      Number.isNaN(parsedCommissioningDate.getTime()) ||
      parsedCommissioningDate < minimumCommissioningDate ||
      parsedCommissioningDate > maximumCommissioningDate
    ) {
      return jsonResponse({ error: "Commissioning date must be between 15 September 2022 and 31 December 2030.", code: "INVALID_COMMISSIONING_DATE" }, 400);
    }
    if (province && !SA_PROVINCES.has(province)) {
      return jsonResponse({ error: "Please select a valid South African province.", code: "INVALID_PROVINCE" }, 400);
    }
    if (segment && segment !== "homeowner" && segment !== "business") {
      return jsonResponse({ error: "Please select homeowner or business.", code: "INVALID_SEGMENT" }, 400);
    }
    if (normalizedPhone && normalizedPhone.replace(/\D/g, "").length < 9) {
      return jsonResponse({ error: "Please enter a valid contact number.", code: "INVALID_PHONE" }, 400);
    }
    if (segment === "business" && companyName !== undefined && normalizedCompany.length < 2) {
      return jsonResponse({ error: "Please enter your business name.", code: "INVALID_COMPANY" }, 400);
    }
    const latitude = Number.isFinite(Number(addressLat)) ? Number(addressLat) : null;
    const longitude = Number.isFinite(Number(addressLng)) ? Number(addressLng) : null;

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return jsonResponse({ error: "Please enter a valid email address.", code: "INVALID_EMAIL" }, 400);
    }


    // Determine agent_id: referral agent or default Crunch Carbon admin
    let agentId: string | null = null;
    const DEFAULT_CRUNCH_CARBON_AGENT = '6538aa1a-c0dc-4ce4-ab6f-bb4368d9fce1'; // Shaun from Crunch Carbon

    if (referralCode) {
      const { data: agent, error: agentError } = await supabase
        .from('profiles')
        .select('id, role, agent_status, first_name, last_name')
        .eq('id', referralCode)
        .eq('role', 'agent')
        .eq('agent_status', 'active')
        .single();

      if (!agentError && agent) {
        agentId = agent.id;
        console.log(`Calculator lead assigned to agent: ${agent.first_name} ${agent.last_name} (${agent.id})`);
      } else {
        console.log(`Invalid or inactive referral code: ${referralCode}, defaulting to Crunch Carbon`);
        agentId = DEFAULT_CRUNCH_CARBON_AGENT;
      }
    } else {
      agentId = DEFAULT_CRUNCH_CARBON_AGENT;
      console.log('No referral code - calculator lead assigned to Crunch Carbon default agent');
    }

    const { data: owningAgent, error: owningAgentError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', agentId)
      .maybeSingle();
    if (owningAgentError || !owningAgent) {
      console.error('Calculator owner is unavailable:', owningAgentError);
      return jsonResponse({ error: "We could not assign your proposal. Please contact Crunch Carbon.", code: "OWNER_UNAVAILABLE" }, 503);
    }

    // Fetch province-specific yield if a province is provided
    let yieldFactor = DEFAULT_ANNUAL_GENERATION_FACTOR;
    if (province) {
      const { data: yieldRow } = await supabase
        .from('regional_solar_yields')
        .select('yield_kwh_per_kwp')
        .eq('province', province)
        .single();
      if (yieldRow && yieldRow.yield_kwh_per_kwp) {
        yieldFactor = Number(yieldRow.yield_kwh_per_kwp);
      }
    }

    // Calculate carbon credits using province yield and tiered client share
    const annualEnergy = Math.round(normalizedSize * yieldFactor);
    const carbonCredits = parseFloat(((annualEnergy / 1000) * DEFAULT_CARBON_FACTOR).toFixed(2));
    const clientSharePercentage = getClientSharePercentage(normalizedSize);

    // Generate secure token (48 char random string)
    const token = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, "");

    // Set expiration to 10 days from now
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 240);

    // Create proposal content
    const projectInfoPayload = {
      size: String(normalizedSize),
      size_display: `${normalizedSize} kWp`,
      commissionDate: commissioningDate,
      commissioning_date: commissioningDate,
      system_size_kwp: normalizedSize,
      annual_energy_kwh: annualEnergy,
      address: normalizedAddress || undefined,
      latitude: latitude ?? undefined,
      longitude: longitude ?? undefined,
      province: province || undefined,
      segment: segment || undefined,
    };

    const proposalContent = {
      clientInfo: {
        email: normalizedEmail,
        name: `${firstName} ${lastName}`.trim(),
        first_name: firstName,
        last_name: lastName,
        phone: normalizedPhone || undefined,
        company_name: normalizedCompany || undefined,
      },
      projectInfo: projectInfoPayload,
      financialInfo: {
        carbon_credits: carbonCredits,
        client_share_percentage: clientSharePercentage,
        yield_factor: yieldFactor,
      }
    };

    // Reuse or create the client atomically. The RPC handles simultaneous requests.
    const { data: clientReferenceId, error: clientError } = await supabase.rpc(
      'find_or_create_client_by_email',
      {
        p_email: normalizedEmail,
        p_first_name: firstName,
        p_last_name: lastName,
        p_phone: normalizedPhone || null,
        p_company_name: normalizedCompany || null,
        p_created_by: agentId,
      },
    );

    if (clientError || !clientReferenceId) {
      console.error('Client creation error:', clientError);
      return jsonResponse({ error: "We could not save your contact details. Please try again.", code: "CLIENT_SAVE_FAILED" }, 500);
    }

    // Keep the client record current when the calculator supplies newer contact details.
    const clientPatch: Record<string, unknown> = {};
    if (normalizedPhone) clientPatch.phone = normalizedPhone;
    if (normalizedCompany) clientPatch.company_name = normalizedCompany;
    if (Object.keys(clientPatch).length > 0) {
      const { error: clientPatchError } = await supabase
        .from('clients')
        .update(clientPatch)
        .eq('id', clientReferenceId);
      if (clientPatchError) console.error('Client detail update error:', clientPatchError);
    }


    const { data: clientRecord, error: clientLookupError } = await supabase
      .from('clients')
      .select('user_id')
      .eq('id', clientReferenceId)
      .single();
    if (clientLookupError) console.error('Client profile lookup error:', clientLookupError);
    let clientProfileId = clientRecord?.user_id;

    if (!clientProfileId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', normalizedEmail)
        .eq('role', 'client')
        .single();

      clientProfileId = profile?.id;
    }

    const proposalTitle = `Solar Project - ${normalizedSize} kWp`;

    // Reuse a recent estimate for the same person at essentially the same size,
    // using the same tolerance as the duplicate guard so a re-run never errors.
    const sizeTolerance = Math.max(0.5, normalizedSize * 0.005);
    const retryWindow = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const findExistingEstimate = async (windowStart: string | null) => {
      let query = supabase
        .from('proposals')
        .select('id, invitation_token, system_size_kwp')
        .eq('client_reference_id', clientReferenceId)
        .eq('project_info->>source', 'public_calculator')
        .is('deleted_at', null)
        .is('archived_at', null)
        .gte('system_size_kwp', normalizedSize - sizeTolerance)
        .lte('system_size_kwp', normalizedSize + sizeTolerance)
        .order('created_at', { ascending: false })
        .limit(1);
      if (windowStart) query = query.gte('created_at', windowStart);
      const { data } = await query.maybeSingle();
      return data;
    };

    const recentProposal = await findExistingEstimate(retryWindow);

    let proposal: { id: string; invitation_token?: string | null } | null = recentProposal;
    let responseToken = recentProposal?.invitation_token ?? token;
    let reusedExisting = Boolean(recentProposal);


    if (!proposal) {
      const { data: insertedProposal, error: insertError } = await supabase
      .from("proposals")
      .insert({
        title: proposalTitle,
        content: { ...proposalContent, source: 'public_calculator' },
        project_info: {
          ...projectInfoPayload,
          source: 'public_calculator',
        },

        eligibility_criteria: {},
        status: 'sent',
        carbon_credits: carbonCredits,
        annual_energy: annualEnergy,
        system_size_kwp: normalizedSize,
        invitation_token: token,
        invitation_expires_at: expiresAt.toISOString(),
        invitation_sent_at: new Date().toISOString(),
        agent_id: agentId,
        client_reference_id: clientReferenceId,
        client_id: clientProfileId,
      })
      .select()
      .single();

      if (insertError) {
        console.error("Insert error:", insertError);
        const isDuplicate = insertError.message?.includes('DUPLICATE_REVIEW_REQUIRED');

        if (isDuplicate) {
          // Fall back to the estimate already on file for this person rather than a dead end.
          const existing = await findExistingEstimate(null);
          if (existing?.id && existing.invitation_token) {
            proposal = existing;
            responseToken = existing.invitation_token;
            reusedExisting = true;

          } else {
            return jsonResponse({
              error: "We already have a report on file for this project. Please contact Crunch Carbon and we will send it to you.",
              code: "DUPLICATE_REVIEW_REQUIRED",
            }, 409);
          }
        } else {
          return jsonResponse({
            error: "We could not create your proposal. Please try again.",
            code: "PROPOSAL_SAVE_FAILED",
          }, 500);
        }
      } else {
        proposal = insertedProposal;
      }
    }


    if (!proposal?.id || !responseToken) {
      return jsonResponse({ error: "Your proposal was saved, but its secure link could not be prepared.", code: "PROPOSAL_LINK_FAILED" }, 500);
    }

    // A reused estimate must still carry the latest contact and address details
    // so the cession agreement is filled in correctly.
    if (reusedExisting) {
      const { data: existingRow } = await supabase
        .from('proposals')
        .select('content, project_info')
        .eq('id', proposal.id)
        .maybeSingle();

      const existingContent = (existingRow?.content ?? {}) as Record<string, unknown>;
      const existingProjectInfo = (existingRow?.project_info ?? {}) as Record<string, unknown>;

      const { error: patchError } = await supabase
        .from('proposals')
        .update({
          content: {
            ...existingContent,
            ...proposalContent,
            source: 'public_calculator',
          },
          project_info: {
            ...existingProjectInfo,
            ...projectInfoPayload,
            source: 'public_calculator',
          },
        })
        .eq('id', proposal.id);
      if (patchError) console.error('Could not refresh reused calculator proposal:', patchError);
    }

    // Build proposal URL
    const siteUrl = Deno.env.get("SITE_URL") || "https://crunchcarbon.com";
    const resultsUrl = `${siteUrl}/proposals/${proposal.id}?token=${responseToken}`;

    let emailDelivered = false;
    // Email delivery does not revoke an otherwise valid on-screen proposal link.
    // Callers that take the user straight to signing opt out with sendEmail: false.
    if (shouldSendEmail) try {


      const emailResponse = await resend.emails.send({
        from: "Crunch Carbon <results@crunchcarbon.com>",
        to: [normalizedEmail],
        subject: `Your Solar Impact Report is Ready! ☀️`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8f9fa;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f9fa; padding: 20px 0;">
              <tr>
                <td align="center">
                  <table cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); box-sizing: border-box;">
                    <tr>
                      <td style="background: linear-gradient(135deg, #FCEE21 0%, #FFD700 100%); padding: 40px 30px; text-align: center;">
                        <h1 style="margin: 0; color: #1a1a1a; font-size: 28px; font-weight: bold;">
                          Your Solar Impact Report is Ready! ☀️
                        </h1>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 40px 30px;">
                        <p style="margin: 0 0 20px; color: #333333; font-size: 16px; line-height: 1.6;">
                           Hi ${normalizedName},
                        </p>
                        <p style="margin: 0 0 30px; color: #333333; font-size: 16px; line-height: 1.6;">
                           Great news! We've crunched the numbers for your <strong>${normalizedSize} kWp solar system</strong> commissioning on <strong>${parsedCommissioningDate.toLocaleDateString('en-ZA', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })}</strong>${province ? ` in <strong>${province}</strong>` : ''}.
                        </p>
                        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
                          <tr>
                            <td>
                              <p style="margin: 0 0 15px; color: #1a1a1a; font-size: 18px; font-weight: bold;">
                                Your Quick Impact Preview:
                              </p>
                              <p style="margin: 0 0 10px; color: #333333; font-size: 15px;">
                                ✅ <strong>Annual Energy:</strong> ~${annualEnergy.toLocaleString()} kWh
                              </p>
                              <p style="margin: 0 0 10px; color: #333333; font-size: 15px;">
                                ✅ <strong>Carbon Offset:</strong> ~${carbonCredits} tonnes CO₂
                              </p>
                              <p style="margin: 0 0 10px; color: #333333; font-size: 15px;">
                                ✅ <strong>Client Share Tier:</strong> ${clientSharePercentage}%
                              </p>
                              <p style="margin: 0; color: #333333; font-size: 15px;">
                                ✅ <strong>Next Step:</strong> Click below to review and sign your proposal
                              </p>
                            </td>
                          </tr>
                        </table>
                        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 30px;">
                          <tr>
                            <td align="center">
                              <a href="${resultsUrl}" style="display: inline-block; background-color: #FCEE21; color: #1a1a1a; font-size: 18px; font-weight: bold; text-decoration: none; padding: 16px 40px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
                                View Your Full Solar Impact Report
                              </a>
                            </td>
                          </tr>
                        </table>
                        <p style="margin: 0 0 10px; color: #666666; font-size: 14px; text-align: center;">
                          This link expires in 10 days
                        </p>
                        <p style="margin: 30px 0 0; color: #666666; font-size: 14px; line-height: 1.6; border-top: 1px solid #e0e0e0; padding-top: 20px;">
                          Questions? Reply to this email or visit <a href="https://crunchcarbon.com" style="color: #1a1a1a; text-decoration: none; font-weight: 600;">crunchcarbon.com</a>
                        </p>
                      </td>
                    </tr>
                    <tr>
                      <td style="background-color: #f8f9fa; padding: 20px 30px; text-align: center;">
                        <p style="margin: 0; color: #999999; font-size: 12px;">
                          © ${new Date().getFullYear()} Crunch Carbon. All rights reserved.
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
      if (emailResponse.error) {
        console.error("Email provider rejected calculator email:", emailResponse.error);
      } else {
        emailDelivered = true;
        console.log("Email sent successfully:", emailResponse.data?.id);
      }
    } catch (emailError) {
      console.error("Failed to send email, but proposal was created:", emailError);
    }

    const response: CalculatorSuccessResponse = {
        success: true,
        proposalId: proposal.id,
        token: responseToken,
        emailDelivered,
        message: !shouldSendEmail
          ? "Proposal created"
          : emailDelivered
            ? "Proposal created and emailed successfully"
            : "Proposal created; email delivery failed",

    };
    return jsonResponse(response);
  } catch (error: any) {
    console.error("Error in send-calculator-results:", error);
    return jsonResponse({ error: "We could not process your proposal. Please try again.", code: "INTERNAL_ERROR" }, 500);
  }
});
