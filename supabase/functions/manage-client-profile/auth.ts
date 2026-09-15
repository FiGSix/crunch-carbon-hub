
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { ErrorResponse, corsHeaders } from "../_shared/types.ts";

// Verify user authentication and roles
export async function verifyUserAuth(
  authHeader: string | null,
  supabase: typeof supabaseAdmin
): Promise<{ userId: string; role: string; email: string | null } | ErrorResponse> {
  if (!authHeader) {
    console.error("No authorization header provided");
    return {
      error: 'No authorization header provided',
      status: 401
    };
  }
  
  // Extract and verify the JWT
  const token = authHeader.replace('Bearer ', '');
  
  try {
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError) {
      console.error("Authentication error:", authError);
      return {
        error: 'Authentication failed - ' + authError.message,
        status: 401
      };
    }
    
    if (!authUser) {
      console.error("No user found in token");
      return {
        error: 'Unauthorized - invalid token or no user found',
        status: 401
      };
    }
    
    console.log(`User authenticated: ${authUser.id}, email: ${authUser.email}`);
    
    // Check if the user has the agent role
    const { data: roleData, error: roleError } = await supabase
      .rpc('get_user_role', { user_id: authUser.id });
    
    if (roleError) {
      console.error("Role verification error:", roleError);
      return {
        error: 'Error verifying user role: ' + roleError.message,
        status: 500
      };
    }
    
    if (roleData !== 'agent' && roleData !== 'admin') {
      console.error("Permission denied: User role is", roleData);
      return {
        error: 'Permission denied. Only agents can create client profiles.',
        status: 403
      };
    }
    
    console.log(`User role verified: ${roleData}`);
    
    return { 
      userId: authUser.id,
      role: roleData,
      email: authUser.email ?? null
    };
  } catch (error) {
    console.error("Unexpected authentication error:", error);
    return {
      error: `Authentication error: ${error.message}`,
      status: 500
    };
  }
}

// Create response with proper headers and status
export function createResponse(data: any, status: number = 200): Response {
  return new Response(
    JSON.stringify(data),
    { 
      status: status, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  );
}
