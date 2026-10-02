console.log("📧 send-auth-email module loading...");

import "../_shared/sandbox.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";
import { Resend } from "npm:resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Lazy initialization - don't access secrets at module load time
let resend: Resend | null = null;
let hookSecret: string | null = null;

// Unique identifier to track emails sent by this edge function (not Supabase default)
const EMAIL_SYSTEM_ID = "CC-EF-V1";

// ============= INLINED EMAIL TEMPLATES =============

function generateSignupVerificationEmail(verificationUrl: string, userEmail: string, otpCode: string, verifyPageUrl: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="background-color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0;">
  <div style="margin: 0 auto; padding: 40px 20px; max-width: 600px;">
    <h1 style="color: #1a1a1a; font-size: 24px; font-weight: 700; line-height: 1.4; margin: 0 0 24px;">Welcome to the Crunch Carbon team!</h1>
    
    <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
      Hi there! We're excited to have you join us in the carbon credit revolution.
    </p>

    <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 12px;">
      <strong>Your 6-digit verification code:</strong>
    </p>

    <div style="margin: 8px 0 24px; padding: 20px; background-color: #FFF8DB; border: 2px dashed #F5D547; border-radius: 8px; text-align: center;">
      <div style="font-family: 'Courier New', monospace; font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #1a1a1a;">
        ${otpCode}
      </div>
    </div>

    <p style="color: #1a1a1a; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
      Enter this code on the verification page:
      <a href="${verifyPageUrl}" style="color: #2563eb;">${verifyPageUrl}</a>
    </p>

    <p style="color: #666666; font-size: 14px; line-height: 1.6; margin: 24px 0 12px; text-align: center;">
      — or —
    </p>

    <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
      Click the button below to verify (note: some corporate email scanners may consume this link before you click it — if that happens, use the 6-digit code above instead):
    </p>

    <div style="margin: 16px 0 32px;">
      <a href="${verificationUrl}" style="background-color: #F5D547; border-radius: 6px; color: #1a1a1a; font-size: 16px; font-weight: 600; text-decoration: none; text-align: center; display: inline-block; padding: 14px 24px;">
        Verify Email Address
      </a>
    </div>

    <p style="color: #666666; font-size: 13px; word-break: break-all; margin: 0 0 16px;">
      Or copy this link: ${verificationUrl}
    </p>

    <p style="color: #666666; font-size: 14px; line-height: 1.6; margin: 0 0 12px; font-style: italic;">
      This verification code and link will expire in 24 hours for security reasons.
    </p>

    <p style="color: #666666; font-size: 14px; line-height: 1.6; margin: 0 0 12px; font-style: italic;">
      Security first, this is South Africa after all ;)
    </p>

    <p style="color: #666666; font-size: 14px; line-height: 1.6; margin: 24px 0 0;">
      If you didn't create an account with Crunch Carbon, you can safely ignore this email.
    </p>

    <p style="color: #666666; font-size: 14px; line-height: 1.6; margin: 24px 0 0;">
      Need help? Contact us at support@crunchcarbon.com
    </p>
    
    <!-- Tracking ID for debugging dual-email issues -->
    <p style="color: #e5e5e5; font-size: 10px; margin-top: 40px;">ref:${EMAIL_SYSTEM_ID}</p>
  </div>
</body>
</html>`;
}

function generatePasswordResetEmail(resetUrl: string, userEmail: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="background-color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0;">
  <div style="margin: 0 auto; padding: 40px 20px; max-width: 600px;">
    <h1 style="color: #1a1a1a; font-size: 24px; font-weight: 700; line-height: 1.4; margin: 0 0 24px;">Password Reset Request</h1>
    
    <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
      We received a request to reset the password for your Crunch Carbon account associated with ${userEmail}.
    </p>

    <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
      Click the button below to choose a new password:
    </p>

    <div style="margin: 32px 0;">
      <a href="${resetUrl}" style="background-color: #F5D547; border-radius: 6px; color: #1a1a1a; font-size: 16px; font-weight: 600; text-decoration: none; text-align: center; display: inline-block; padding: 14px 24px;">
        Reset Password
      </a>
    </div>

    <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
      Or copy and paste this link into your browser:
    </p>

    <p style="color: #2563eb; font-size: 14px; word-break: break-all; margin: 0 0 16px;">
      ${resetUrl}
    </p>

    <p style="color: #666666; font-size: 14px; line-height: 1.6; margin: 0 0 12px;">
      This password reset link will expire in 1 hour for security reasons.
    </p>

    <div style="color: #dc2626; font-size: 14px; line-height: 1.6; margin: 24px 0; padding: 12px; background-color: #fef2f2; border-radius: 6px;">
      If you didn't request a password reset, please ignore this email or contact support if you have concerns about your account security.
    </div>

    <p style="color: #666666; font-size: 14px; line-height: 1.6; margin: 24px 0 0;">
      Stay safe out there!<br />
      The Crunch Carbon Team
    </p>

    <p style="color: #666666; font-size: 14px; line-height: 1.6; margin: 24px 0 0;">
      Need help? Contact us at support@crunchcarbon.com
    </p>
    
    <!-- Tracking ID for debugging dual-email issues -->
    <p style="color: #e5e5e5; font-size: 10px; margin-top: 40px;">ref:${EMAIL_SYSTEM_ID}</p>
  </div>
</body>
</html>`;
}

function generateEmailChangeEmail(confirmUrl: string, userEmail: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="background-color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0;">
  <div style="margin: 0 auto; padding: 40px 20px; max-width: 600px;">
    <h1 style="color: #1a1a1a; font-size: 24px; font-weight: 700; line-height: 1.4; margin: 0 0 24px;">Confirm Email Address Change</h1>
    
    <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
      We received a request to change the email address for your Crunch Carbon account to ${userEmail}.
    </p>

    <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
      Please confirm this change by clicking the button below:
    </p>

    <div style="margin: 32px 0;">
      <a href="${confirmUrl}" style="background-color: #F5D547; border-radius: 6px; color: #1a1a1a; font-size: 16px; font-weight: 600; text-decoration: none; text-align: center; display: inline-block; padding: 14px 24px;">
        Confirm Email Change
      </a>
    </div>

    <p style="color: #1a1a1a; font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
      Or copy and paste this link into your browser:
    </p>

    <p style="color: #2563eb; font-size: 14px; word-break: break-all; margin: 0 0 16px;">
      ${confirmUrl}
    </p>

    <p style="color: #666666; font-size: 14px; line-height: 1.6; margin: 0 0 12px;">
      This confirmation link will expire in 24 hours for security reasons.
    </p>

    <div style="color: #dc2626; font-size: 14px; line-height: 1.6; margin: 24px 0; padding: 12px; background-color: #fef2f2; border-radius: 6px;">
      If you didn't request this email change, please contact support immediately at support@crunchcarbon.com. Your account security may be at risk.
    </div>

    <p style="color: #666666; font-size: 14px; line-height: 1.6; margin: 24px 0 0;">
      Stay secure,<br />
      The Crunch Carbon Team
    </p>
    
    <!-- Tracking ID for debugging dual-email issues -->
    <p style="color: #e5e5e5; font-size: 10px; margin-top: 40px;">ref:${EMAIL_SYSTEM_ID}</p>
  </div>
</body>
</html>`;
}

// ============= MAIN HANDLER =============

serve(async (req) => {
  const startTime = Date.now();
  const requestId = crypto.randomUUID().substring(0, 8);
  
  console.log(`🚀 [${requestId}] send-auth-email invoked`, { method: req.method, url: req.url });

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  // Lazy initialize secrets - with defensive checks
  if (!resend || !hookSecret) {
    const apiKey = Deno.env.get("RESEND_API_KEY");
    const secret = Deno.env.get("SEND_AUTH_EMAIL_HOOK_SECRET");
    
    console.log(`🔑 [${requestId}] Secret check:`, { 
      hasResendKey: !!apiKey, 
      resendKeyPrefix: apiKey?.substring(0, 8),
      hasHookSecret: !!secret,
      secretLength: secret?.length,
      secretPrefix: secret?.substring(0, 15)
    });
    
    if (!apiKey) {
      console.error(`❌ [${requestId}] CRITICAL: Missing RESEND_API_KEY! Supabase may fall back to default mailer.`);
      // Return 500 to signal failure - this MUST NOT be ignored
      return new Response(
        JSON.stringify({ error: "Missing RESEND_API_KEY configuration", critical: true }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    
    if (!secret) {
      console.error(`❌ [${requestId}] CRITICAL: Missing SEND_AUTH_EMAIL_HOOK_SECRET! Supabase may fall back to default mailer.`);
      // Return 500 to signal failure - this MUST NOT be ignored
      return new Response(
        JSON.stringify({ error: "Missing SEND_AUTH_EMAIL_HOOK_SECRET configuration", critical: true }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    
    resend = new Resend(apiKey);
    // Handle both formats: with or without v1,whsec_ prefix
    hookSecret = secret.startsWith("v1,whsec_") 
      ? secret.replace("v1,whsec_", "") 
      : secret;
    
    console.log(`✅ [${requestId}] Secrets initialized successfully`);
  }

  try {
    const payload = await req.text();
    const headers = Object.fromEntries(req.headers);
    
    console.log(`📨 [${requestId}] Received webhook payload length:`, payload.length);
    
    // Verify webhook signature
    const wh = new Webhook(hookSecret);
    let webhookData: {
      user: { email: string; id: string };
      email_data: {
        token: string;
        token_hash: string;
        redirect_to: string;
        email_action_type: string;
        site_url: string;
      };
    };
    
    try {
      webhookData = wh.verify(payload, headers) as typeof webhookData;
      console.log(`✅ [${requestId}] Webhook signature verified`);
    } catch (verifyError: any) {
      console.error(`❌ [${requestId}] Webhook verification failed:`, verifyError.message);
      // Return 401 for bad signature - Supabase should NOT fall back
      return new Response(
        JSON.stringify({ error: "Webhook verification failed", details: verifyError.message }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { user, email_data } = webhookData;
    const { email_action_type, token_hash, redirect_to } = email_data;

    // CRITICAL: Use our actual app URL, not email_data.site_url which returns Supabase's URL
    const siteUrl = Deno.env.get('SITE_URL') || 'https://crunchcarbon.com';

    console.log(`📧 [${requestId}] Processing auth email:`, {
      type: email_action_type,
      email: user.email,
      userId: user.id,
      token_hash_prefix: token_hash?.substring(0, 8),
      supabase_site_url: email_data.site_url,
      using_site_url: siteUrl,
      system_id: EMAIL_SYSTEM_ID,
    });

    // Map email_action_type to the correct EmailOtpType for verification
    const otpTypeMap: Record<string, string> = {
      'signup': 'signup',
      'invite': 'invite',
      'recovery': 'recovery',
      'email_change': 'email_change',
    };
    
    const verifyType = otpTypeMap[email_action_type] || email_action_type;

    let html: string;
    let subject: string;

    // Generate appropriate email based on type
    // IMPORTANT: URL-encode redirect_to to prevent URL corruption from special characters
    const encodedRedirectTo = encodeURIComponent(redirect_to || '');
    
    switch (email_action_type) {
      case "signup":
      case "invite":
        html = generateSignupVerificationEmail(
          `${siteUrl}/auth/callback?token_hash=${token_hash}&type=${verifyType}&redirect_to=${encodedRedirectTo}`,
          user.email,
          email_data.token,
          `${siteUrl}/verify-email?email=${encodeURIComponent(user.email)}`
        );
        subject = "Welcome to Crunch Carbon - Verify Your Email";
        break;

      case "recovery":
        html = generatePasswordResetEmail(
          `${siteUrl}/auth/callback?token_hash=${token_hash}&type=recovery&redirect_to=${encodedRedirectTo}`,
          user.email
        );
        subject = "Reset Your Crunch Carbon Password";
        break;

      case "email_change":
        html = generateEmailChangeEmail(
          `${siteUrl}/auth/callback?token_hash=${token_hash}&type=email_change&redirect_to=${encodedRedirectTo}`,
          user.email
        );
        subject = "Confirm Your Email Change";
        break;

      default:
        console.error(`❌ [${requestId}] Unsupported email type:`, email_action_type);
        // Return 400 for unsupported type - clear error
        return new Response(
          JSON.stringify({ error: `Unsupported email type: ${email_action_type}` }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
    }

    console.log(`📤 [${requestId}] Sending email via Resend...`);
    
    // Send email via Resend with custom headers for tracking
    const { data, error } = await resend.emails.send({
      from: "Crunch Carbon <noreply@crunchcarbon.com>",
      to: [user.email],
      subject,
      html,
      headers: {
        "X-Email-System": EMAIL_SYSTEM_ID,
        "X-Request-Id": requestId,
        "X-User-Id": user.id,
      },
    });

    if (error) {
      console.error(`❌ [${requestId}] CRITICAL: Resend error:`, error);
      // Return 500 on Resend failure - this is a critical error
      return new Response(
        JSON.stringify({ error: "Email delivery failed", details: error, critical: true }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const duration = Date.now() - startTime;
    console.log(`✅ [${requestId}] Email sent successfully in ${duration}ms:`, {
      emailId: data?.id,
      to: user.email,
      type: email_action_type,
      system: EMAIL_SYSTEM_ID,
    });

    // Return 200 with success - Supabase will NOT fall back to default mailer
    return new Response(
      JSON.stringify({ 
        success: true, 
        emailId: data?.id,
        system: EMAIL_SYSTEM_ID,
        requestId,
        duration,
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
    const duration = Date.now() - startTime;
    console.error(`❌ [${requestId}] CRITICAL ERROR in send-auth-email (${duration}ms):`, {
      message: error.message,
      stack: error.stack,
      system: EMAIL_SYSTEM_ID,
    });
    
    // Return 500 on any unhandled error - prevents silent fallback
    return new Response(
      JSON.stringify({
        error: error.message,
        stack: error.stack,
        critical: true,
        system: EMAIL_SYSTEM_ID,
        requestId,
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  }
});

console.log("📧 send-auth-email module loaded successfully");
