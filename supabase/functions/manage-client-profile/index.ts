
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { corsHeaders, ErrorResponse } from "../_shared/types.ts";
import { verifyUserAuth, createResponse } from "./auth.ts";
import { processClientRequest } from "./client/client-processor.ts";

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get auth header
    const authHeader = req.headers.get("Authorization");
    
    // Verify auth and get user details
    const authResult = await verifyUserAuth(authHeader, supabaseAdmin);
    
    if ('error' in authResult) {
      return createResponse(authResult, authResult.status);
    }
    
    // User is authenticated, proceed with client management
    const { userId, role, email: callerEmail } = authResult;
    
    // Parse request body
    const requestBody = await req.json();
    const { name, email, phone, companyName, existingClient } = requestBody;
    
    if (!email) {
      return createResponse({
        error: "Email is required"
      }, 400);
    }

    // Hard business rule: a partner may not act as both partner and client
    if (
      role !== 'admin' &&
      email.trim().toLowerCase() === (callerEmail || '').trim().toLowerCase()
    ) {
      return createResponse({
        error: "You cannot list yourself as the client. A partner may not act as both partner and client on the same proposal. Enter your client's email address — a colleague at your company can be added instead."
      }, 400);
    }
    
    
    // Process the client request using the processClientRequest function
    const result = await processClientRequest(
      {
        email: email.toLowerCase().trim(),
        firstName: name?.split(' ')[0] || "",
        lastName: name?.split(' ').slice(1).join(' ') || "",
        phone: phone || null,
        companyName: companyName || null,
        existingClient: existingClient || false
      },
      userId,
      supabaseAdmin
    );
    
    // Check if there was an error in processing
    if ('error' in result) {
      return createResponse(result, result.status || 500);
    }
    
    // Return successful response
    return createResponse(result);
    
  } catch (error) {
    console.error("Uncaught error in manage-client-profile:", error);
    return createResponse({
      error: `Unexpected error: ${error instanceof Error ? error.message : String(error)}`
    }, 500);
  }
});
