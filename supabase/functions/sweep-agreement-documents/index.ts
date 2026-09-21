// Finish off any proposal_agreements row that carries a master signature but has
// no generated document yet.
//
// These rows are created by the propagate_master_agreement() DB trigger when one
// client signs and their other proposals inherit that signature. Each still needs
// its OWN PDF (own site/party details) generated and emailed — this sweep does
// that, so inheritance is never silent and never needs a manual trigger.
//
// Callable by the service role (internal invocations) or an admin JWT.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ---- caller gate ------------------------------------------------------
    const bearer = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
    let allowed = bearer === serviceKey;
    if (!allowed && bearer) {
      const { data: { user } } = await admin.auth.getUser(bearer);
      if (user) {
        const { data: isAdmin } = await admin.rpc("has_role", {
          _user_id: user.id,
          _role: "admin",
        });
        allowed = Boolean(isAdmin);
      }
    }
    if (!allowed) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const clientId: string | undefined = body.clientId;
    const limit: number = Math.min(Number(body.limit) || 25, 100);
    // Recovery runs can rebuild documents without notifying the client.
    const sendEmail: boolean = body.sendEmail !== false;

    let query = admin
      .from("proposal_agreements")
      .select("id, proposal_id, proposals!inner(client_reference_id)")
      .not("client_cession_signature_id", "is", null)
      .is("pdf_path", null)
      .order("created_at", { ascending: true })
      .limit(limit);

    if (clientId) query = query.eq("proposals.client_reference_id", clientId);

    const { data: pending, error } = await query;
    if (error) return json({ error: error.message }, 500);

    if (!pending?.length) return json({ success: true, processed: 0 });

    let processed = 0;
    const failures: string[] = [];

    for (const row of pending) {
      try {
        const { error: pdfError } = await admin.functions.invoke(
          "generate-signed-agreement-pdf",
          { body: { proposalId: row.proposal_id, agreementId: row.id } },
        );
        if (pdfError) {
          failures.push(`${row.id}: ${pdfError.message}`);
          continue;
        }

        const { data: proposal } = await admin
          .from("proposals")
          .select("client:clients!proposals_client_reference_id_fkey(email)")
          .eq("id", row.proposal_id)
          .maybeSingle();
        const email = (proposal as any)?.client?.email;
        if (email) {
          await admin.functions.invoke("send-cession-agreement-email", {
            body: { proposalId: row.proposal_id, clientEmail: email },
          });
        }
        processed++;
      } catch (e) {
        failures.push(`${row.id}: ${String(e)}`);
      }
    }

    console.log(
      `[sweep-agreement-documents] processed=${processed} failed=${failures.length}`,
    );
    return json({ success: true, processed, failures });
  } catch (error) {
    console.error("[sweep-agreement-documents] Error:", error);
    return json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      500,
    );
  }
});
