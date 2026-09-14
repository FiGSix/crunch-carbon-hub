import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailRequest {
  proposalId: string;
  clientEmail: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);

    const { proposalId, clientEmail }: EmailRequest = await req.json();

    console.log(`[Cession Email] Sending confirmation email for proposal: ${proposalId} to ${clientEmail}`);

    // Fetch proposal data with client and agent information
    const { data: proposal, error: proposalError } = await supabase
      .from('proposals')
      .select(`
        *,
        agent:profiles!proposals_agent_id_fkey(first_name, last_name, company_name, email),
        client:clients!proposals_client_reference_id_fkey(first_name, last_name, email, company_name)
      `)
      .eq('id', proposalId)
      .single();

    if (proposalError || !proposal) {
      console.error('[Cession Email] Error fetching proposal:', proposalError);
      throw new Error('Proposal not found');
    }

    // Contact on the client record — used only as a last-resort fallback. The person
    // who actually signed is resolved from the agreement/signature records below.
    const clientName = proposal.client?.first_name 
      ? `${proposal.client.first_name} ${proposal.client.last_name || ''}`
      : proposal.content?.clientInfo?.name || 'Valued Client';

    const projectName = proposal.title || 'Your Carbon Credit Project';
    const systemSize = proposal.system_size_kwp 
      ? `${(proposal.system_size_kwp / 1000).toFixed(2)} MWp`
      : 'N/A';
    const carbonCredits = proposal.carbon_credits 
      ? `${proposal.carbon_credits.toLocaleString()} credits`
      : 'N/A';

    console.log(`[Cession Email] Fetching signed agreement PDF for proposal: ${proposalId}`);

    // Fetch the signed document reference from proposal_agreements, retrying briefly
    // in case the upstream generate-signed-agreement-pdf write hasn't propagated yet.
    // `signed-agreements` is a PRIVATE bucket, so what we store is a bare object path.
    let agreement:
      | {
          pdf_path: string | null;
          signed_pdf_url: string | null;
          typed_name: string | null;
          client_cession_signature_id: string | null;
          metadata: Record<string, unknown> | null;
        }
      | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const { data, error } = await supabase
        .from('proposal_agreements')
        .select('pdf_path, signed_pdf_url, typed_name, client_cession_signature_id, metadata')
        .eq('proposal_id', proposalId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) {
        console.error(`[Cession Email] Attempt ${attempt} - error fetching agreement:`, error);
      }
      agreement = data ?? null;
      if (agreement?.pdf_path || agreement?.signed_pdf_url) break;
      if (attempt < 3) {
        console.log(`[Cession Email] Signed document not present on attempt ${attempt}, waiting 1500ms...`);
        await new Promise((r) => setTimeout(r, 1500));
      }
    }

    // The person who actually signed — never the contact on the client record.
    // Inherited sibling agreements carry only typed_name, so fall back to the
    // master cession signature before falling back to the contact.
    let signatoryName =
      (agreement?.metadata?.['signatory_name'] as string | undefined)?.trim() ||
      agreement?.typed_name?.trim() ||
      '';

    if (!signatoryName && agreement?.client_cession_signature_id) {
      const { data: masterSignature } = await supabase
        .from('client_cession_signatures')
        .select('typed_name, metadata')
        .eq('id', agreement.client_cession_signature_id)
        .maybeSingle();
      signatoryName =
        (masterSignature?.metadata?.['signatory_name'] as string | undefined)?.trim() ||
        masterSignature?.typed_name?.trim() ||
        '';
    }

    const greetingName = signatoryName || clientName;

    const signedRef = agreement?.pdf_path || agreement?.signed_pdf_url || null;
    const pdfUrl = signedRef || proposal.pdf_url;

    if (!signedRef) {
      console.warn('[Cession Email] ⚠️ Signed PDF still not available after retries — attaching UNSIGNED proposal PDF as fallback. Investigate generate-signed-agreement-pdf logs for this proposal.');
    } else {
      console.log('[Cession Email] Using signed agreement document:', signedRef);
    }


    let pdfAttachment = null;

    // Fetch PDF via storage (private buckets) using service role
    if (pdfUrl) {
      try {
        // Accept a bare object path (current format) or a legacy public/signed URL.
        const asPath = (value: string, bucket: string): string | null => {
          const m = value.match(new RegExp(`/object/(?:public|sign|authenticated)/${bucket}/([^?]+)`));
          if (m) return decodeURIComponent(m[1]);
          return /^https?:\/\//i.test(value) ? null : value.replace(/^\/+/, '');
        };

        const url = pdfUrl as string;
        const isSignedDoc = Boolean(signedRef) && url === signedRef;
        const signedPath = isSignedDoc
          ? asPath(url, 'signed-agreements')
          : (url.includes('/signed-agreements/') ? asPath(url, 'signed-agreements') : null);
        const proposalPath = signedPath ? null : asPath(url, 'proposal-pdfs');

        let pdfBuffer: ArrayBuffer | null = null;

        if (signedPath) {
          console.log(`[Cession Email] Downloading from signed-agreements: ${signedPath}`);
          const { data: blob, error } = await supabase.storage.from('signed-agreements').download(signedPath);
          if (error) throw error;
          pdfBuffer = await blob!.arrayBuffer();
        } else if (proposalPath) {
          console.log(`[Cession Email] Downloading from proposal-pdfs: ${proposalPath}`);
          const { data: blob, error } = await supabase.storage.from('proposal-pdfs').download(proposalPath);
          if (error) throw error;
          pdfBuffer = await blob!.arrayBuffer();
        } else {
          // Legacy fallback: an absolute URL we can't map to a known bucket.
          const r = await fetch(url);
          if (r.ok) pdfBuffer = await r.arrayBuffer();
        }


        if (pdfBuffer) {
          const filename = `Cession_Agreement_${projectName.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
          const uint8Array = new Uint8Array(pdfBuffer);
          // Encode in chunks: spreading a whole multi-hundred-KB PDF into
          // String.fromCharCode blows the call stack and silently drops the
          // attachment.
          let binary = '';
          const CHUNK = 8192;
          for (let i = 0; i < uint8Array.length; i += CHUNK) {
            binary += String.fromCharCode(...uint8Array.subarray(i, i + CHUNK));
          }
          const base64String = btoa(binary);
          pdfAttachment = { filename, content: base64String };
          console.log(`[Cession Email] PDF fetched, size: ${pdfBuffer.byteLength} bytes`);
        } else {
          console.warn('[Cession Email] PDF buffer empty');
        }
      } catch (error) {
        console.error('[Cession Email] Error fetching PDF:', error);
      }
    }

    // Generate email HTML
    const emailHtml = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Cession Agreement Confirmed</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8f9fa;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f9fa; padding: 20px 0;">
          <tr>
            <td align="center" style="padding: 20px;">
              <table cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); box-sizing: border-box;">
                
                <!-- Header with Crunch Carbon branding -->
                <tr>
                  <td style="background: linear-gradient(135deg, #F4C430 0%, #E6B800 100%); padding: 30px; text-align: center;">
                    <h1 style="margin: 0; color: #1A1A1A; font-size: 28px; font-weight: 700;">Cession Agreement Confirmed</h1>
                  </td>
                </tr>

                <!-- Main content -->
                <tr>
                  <td style="background-color: #ffffff; padding: 40px 30px;">
                    <p style="font-size: 16px; color: #1A1A1A; margin: 0 0 20px 0;">
                      Dear <strong>${greetingName}</strong>,
                    </p>

                    <p style="font-size: 16px; color: #1A1A1A; line-height: 1.6; margin: 0 0 20px 0;">
                      Thank you for signing the <strong>Cession Agreement</strong> for your carbon credit project. We are delighted to confirm your acceptance and look forward to working with you.
                    </p>

                    <!-- Project Summary Box -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F8F9FA; border-left: 4px solid #F4C430; border-radius: 4px; margin: 30px 0;">
                      <tr>
                        <td style="padding: 20px;">
                          <h2 style="margin: 0 0 15px 0; color: #1A1A1A; font-size: 18px; font-weight: 600;">Project Summary</h2>
                          <table style="width: 100%; border-collapse: collapse;">
                            <tr>
                              <td style="padding: 8px 0; color: #666666; font-size: 14px;">Project Name:</td>
                              <td style="padding: 8px 0; color: #1A1A1A; font-size: 14px; font-weight: 600; text-align: right;">${projectName}</td>
                            </tr>
                            <tr>
                              <td style="padding: 8px 0; color: #666666; font-size: 14px;">System Size:</td>
                              <td style="padding: 8px 0; color: #1A1A1A; font-size: 14px; font-weight: 600; text-align: right;">${systemSize}</td>
                            </tr>
                            <tr>
                              <td style="padding: 8px 0; color: #666666; font-size: 14px;">Est. Carbon Credits:</td>
                              <td style="padding: 8px 0; color: #1A1A1A; font-size: 14px; font-weight: 600; text-align: right;">${carbonCredits}</td>
                            </tr>
                            ${signatoryName ? `
                            <tr>
                              <td style="padding: 8px 0; color: #666666; font-size: 14px;">Signed By:</td>
                              <td style="padding: 8px 0; color: #1A1A1A; font-size: 14px; font-weight: 600; text-align: right;">${signatoryName}</td>
                            </tr>` : ''}
                          </table>
                        </td>
                      </tr>
                    </table>

                    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #FFF9E6; border: 1px solid #F4C430; border-radius: 4px; margin: 25px 0;">
                      <tr>
                        <td style="padding: 15px;">
                          <p style="margin: 0; color: #1A1A1A; font-size: 14px; line-height: 1.5;">
                            📎 <strong>Please find your complete Cession Agreement attached as a PDF.</strong> We recommend saving this document for your records.
                          </p>
                        </td>
                      </tr>
                    </table>

                    <p style="font-size: 16px; color: #1A1A1A; line-height: 1.6; margin: 0 0 20px 0;">
                      Our team will now proceed with the next steps to process your carbon credits. You will receive updates as we progress through each stage of the project.
                    </p>

                    <p style="font-size: 16px; color: #1A1A1A; line-height: 1.6; margin: 0 0 30px 0;">
                      If you have any questions or need assistance, please don't hesitate to contact us.
                    </p>

                    <p style="font-size: 16px; color: #1A1A1A; margin: 0 0 5px 0;">
                      Best regards,
                    </p>
                    <p style="font-size: 16px; color: #1A1A1A; font-weight: 600; margin: 5px 0 0 0;">
                      The Crunch Carbon Team
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background-color: #1A1A1A; padding: 25px 30px; text-align: center;">
                    <p style="margin: 0 0 10px 0; color: #CCCCCC; font-size: 14px;">
                      Crunch Carbon - Sustainable Energy Solutions
                    </p>
                    <p style="margin: 0; color: #999999; font-size: 12px;">
                      For support, contact us at <a href="mailto:support@crunchcarbon.com" style="color: #F4C430; text-decoration: none;">support@crunchcarbon.com</a>
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

    // Send email with or without attachment
    const emailPayload: any = {
      from: "Crunch Carbon <proposals@crunchcarbon.com>",
      to: [clientEmail],
      subject: `Cession Agreement Confirmation - ${projectName}`,
      html: emailHtml,
    };

    if (pdfAttachment) {
      emailPayload.attachments = [pdfAttachment];
      console.log('[Cession Email] Sending email with PDF attachment');
    } else {
      console.log('[Cession Email] Sending email without attachment (PDF fetch failed)');
    }

    const { data: emailResult, error: emailError } = await resend.emails.send(emailPayload);

    if (emailError) {
      console.error('[Cession Email] Error sending email:', emailError);
      throw new Error(`Failed to send email: ${emailError.message}`);
    }

    console.log('[Cession Email] Email sent successfully:', emailResult);

    return new Response(
      JSON.stringify({ 
        success: true,
        emailId: emailResult.id,
        message: "Cession agreement confirmation email sent successfully"
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('[Cession Email] Error in send-cession-agreement-email function:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Failed to send cession agreement email",
        details: error instanceof Error ? error.stack : undefined
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
