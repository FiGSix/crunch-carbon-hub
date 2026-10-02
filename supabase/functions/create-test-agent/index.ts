
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { supabaseAdmin } from "../_shared/supabase-admin.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Only one named owner account may create test partner accounts.
  const OWNER_EMAIL = "shaun@crunchcarbon.com";
  const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
  const { data: { user: caller } } = token
    ? await supabaseAdmin.auth.getUser(token)
    : { data: { user: null } };
  if (!caller || caller.email?.toLowerCase() !== OWNER_EMAIL || !caller.email_confirmed_at) {
    return new Response(JSON.stringify({ error: "Not allowed" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {

    // Get the request body
    const { email, password, firstName, lastName, companyName } = await req.json();

    if (!email || !password) {
      return new Response(
        JSON.stringify({
          error: "Email and password are required"
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check if the user already exists
    const { data: existingUser, error: checkError } = await supabaseAdmin.auth.admin.getUserByEmail(email);
    
    if (checkError && checkError.message !== "User not found") {
      throw checkError;
    }

    // If user already exists, return error
    if (existingUser) {
      return new Response(
        JSON.stringify({
          error: "User with this email already exists",
          user: existingUser
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create the user with agent role
    const { data: userData, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Automatically confirm the email
      user_metadata: {
        role: "agent",
        first_name: firstName || "Test",
        last_name: lastName || "Agent",
        company_name: companyName || "Test Company",
        terms_accepted: true,
        terms_accepted_at: new Date().toISOString(),
      },
    });

    if (createUserError) {
      throw createUserError;
    }

    // Make sure the profile record is created properly
    if (userData.user) {
      // Check if profile exists
      const { data: existingProfile } = await supabaseAdmin
        .from("profiles")
        .select()
        .eq("id", userData.user.id)
        .single();

      // If profile doesn't exist, create it manually
      if (!existingProfile) {
        await supabaseAdmin.from("profiles").insert({
          id: userData.user.id,
          email: email,
          role: "agent",
          first_name: firstName || "Test",
          last_name: lastName || "Agent",
          company_name: companyName || "Test Company",
          terms_accepted_at: new Date().toISOString(),
        });
      }
    }

    return new Response(
      JSON.stringify({
        message: "Test agent account created successfully",
        user: userData.user
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error creating test agent:", error);
    
    return new Response(
      JSON.stringify({
        error: error.message || "An error occurred while creating the test agent"
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
