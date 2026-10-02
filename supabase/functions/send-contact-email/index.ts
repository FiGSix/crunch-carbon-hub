import "../_shared/sandbox.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "https://uyjryuopuqgmsvayiccl.supabase.co";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ContactFormData {
  name: string;
  email: string;
  subject: string;
  question: string;
  phone?: string;
  company?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData: ContactFormData = await req.json();
    const { name, email, subject, question, phone, company } = formData;

    // Validate required fields
    if (!name || !email || !subject || !question) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Silent block: drop submissions from suppressed emails
    const normalizedEmail = email.toLowerCase().trim();
    const { data: isSuppressed, error: suppressionError } = await supabase.rpc(
      "is_client_email_suppressed",
      { p_email: normalizedEmail }
    );
    if (suppressionError) {
      console.warn("Suppression check failed, proceeding:", suppressionError);
    } else if (isSuppressed) {
      console.log("Blocked contact submission from suppressed email:", normalizedEmail);
      return new Response(
        JSON.stringify({ success: true, blocked: true, message: "Your message has been sent successfully!" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get IP address and user agent for tracking
    const ipAddressRaw = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || null;
    const ipAddress = ipAddressRaw ? ipAddressRaw.split(',')[0].trim() : null;
    const userAgent = req.headers.get("user-agent") || "unknown";

    console.log(`Processing contact form from ${name} (${email})`);

    // Insert into database
    const { data: submission, error: dbError } = await supabase
      .from("contact_submissions")
      .insert({
        name,
        email,
        subject,
        question,
        phone,
        company,
        ip_address: ipAddress,
        user_agent: userAgent,
        status: "new",
      })
      .select()
      .single();

    if (dbError) {
      console.error("Database error:", dbError);
      throw new Error(`Failed to save submission: ${dbError.message}`);
    }

    console.log(`Saved submission to database: ${submission.id}`);

    // Send notification email to Crunch Carbon
    const notificationEmailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%); color: white; padding: 30px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">New Contact Form Submission</h1>
        </div>
        
        <div style="background: #f5f5f5; padding: 30px;">
          <div style="background: white; padding: 25px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h2 style="color: #1a1a1a; margin-top: 0;">Contact Details</h2>
            
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #e0e0e0; font-weight: bold; color: #555;">Name:</td>
                <td style="padding: 10px 0; border-bottom: 1px solid #e0e0e0; color: #1a1a1a;">${name}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #e0e0e0; font-weight: bold; color: #555;">Email:</td>
                <td style="padding: 10px 0; border-bottom: 1px solid #e0e0e0; color: #1a1a1a;"><a href="mailto:${email}" style="color: #2563eb; text-decoration: none;">${email}</a></td>
              </tr>
              ${phone ? `
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #e0e0e0; font-weight: bold; color: #555;">Phone:</td>
                <td style="padding: 10px 0; border-bottom: 1px solid #e0e0e0; color: #1a1a1a;">${phone}</td>
              </tr>
              ` : ''}
              ${company ? `
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #e0e0e0; font-weight: bold; color: #555;">Company:</td>
                <td style="padding: 10px 0; border-bottom: 1px solid #e0e0e0; color: #1a1a1a;">${company}</td>
              </tr>
              ` : ''}
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #e0e0e0; font-weight: bold; color: #555;">Subject:</td>
                <td style="padding: 10px 0; border-bottom: 1px solid #e0e0e0; color: #1a1a1a;">${subject}</td>
              </tr>
            </table>
            
            <h3 style="color: #1a1a1a; margin-top: 25px; margin-bottom: 10px;">Message:</h3>
            <div style="background: #f9f9f9; padding: 15px; border-radius: 5px; border-left: 4px solid #2563eb;">
              <p style="margin: 0; color: #333; white-space: pre-wrap;">${question}</p>
            </div>
            
            <div style="margin-top: 25px; padding-top: 20px; border-top: 1px solid #e0e0e0; font-size: 12px; color: #888;">
              <p style="margin: 5px 0;"><strong>Submission ID:</strong> ${submission.id}</p>
              <p style="margin: 5px 0;"><strong>Submitted:</strong> ${new Date().toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' })}</p>
              <p style="margin: 5px 0;"><strong>IP Address:</strong> ${ipAddress}</p>
            </div>
          </div>
        </div>
        
        <div style="background: #1a1a1a; color: #888; padding: 20px; text-align: center; font-size: 12px;">
          <p style="margin: 0;">This is an automated notification from the Crunch Carbon contact form.</p>
        </div>
      </div>
    `;

    const { error: notificationError } = await resend.emails.send({
      from: "Crunch Carbon Contact Form <noreply@crunchcarbon.com>",
      to: ["info@crunchcarbon.com"],
      subject: `New Contact Form: ${subject}`,
      html: notificationEmailHtml,
      reply_to: email,
    });

    if (notificationError) {
      console.error("Failed to send notification email:", notificationError);
      // Don't throw - continue to send auto-reply
    } else {
      console.log("Notification email sent to info@crunchcarbon.com");
    }

    // Send auto-reply to submitter
    const autoReplyHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%); color: white; padding: 30px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">Thank You for Contacting Crunch Carbon</h1>
        </div>
        
        <div style="background: #f5f5f5; padding: 30px;">
          <div style="background: white; padding: 25px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h2 style="color: #1a1a1a; margin-top: 0;">Hi ${name},</h2>
            
            <p style="color: #333; line-height: 1.6;">
              Thank you for reaching out to us. We have received your message and our team will get back to you as soon as possible.
            </p>
            
            <div style="background: #f9f9f9; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #2563eb;">
              <h3 style="color: #1a1a1a; margin-top: 0; font-size: 16px;">Your Message Summary:</h3>
              <p style="margin: 5px 0; color: #555;"><strong>Subject:</strong> ${subject}</p>
              <p style="margin: 5px 0; color: #555;"><strong>Message:</strong></p>
              <p style="color: #333; white-space: pre-wrap; margin-top: 10px;">${question}</p>
            </div>
            
            <p style="color: #333; line-height: 1.6;">
              In the meantime, feel free to explore our website to learn more about how we're helping businesses reduce their carbon footprint through innovative carbon credit solutions.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="https://crunchcarbon.com" style="background: #1a1a1a; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Visit Our Website</a>
            </div>
          </div>
        </div>
        
        <div style="background: #1a1a1a; color: #888; padding: 20px; text-align: center; font-size: 12px;">
          <p style="margin: 0;">Crunch Carbon | Making Carbon Credits Simple</p>
          <p style="margin: 10px 0 0 0;">
            <a href="https://crunchcarbon.com" style="color: #888; text-decoration: none;">crunchcarbon.com</a> | 
            <a href="mailto:info@crunchcarbon.com" style="color: #888; text-decoration: none;">info@crunchcarbon.com</a>
          </p>
        </div>
      </div>
    `;

    const { error: autoReplyError } = await resend.emails.send({
      from: "Crunch Carbon <noreply@crunchcarbon.com>",
      to: [email],
      subject: "Thank you for contacting Crunch Carbon",
      html: autoReplyHtml,
    });

    if (autoReplyError) {
      console.error("Failed to send auto-reply email:", autoReplyError);
      // Don't throw - the main notification was sent
    } else {
      console.log(`Auto-reply sent to ${email}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Your message has been sent successfully!",
        submissionId: submission.id 
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
    console.error("Error in send-contact-email function:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message || "Failed to process contact form submission" 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
