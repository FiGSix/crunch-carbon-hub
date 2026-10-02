import "../_shared/sandbox.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";
import { corsHeaders } from "../_shared/cors.ts";
import { renderBroadcastEmail, BROADCAST_BRAND } from "../_shared/broadcast-template.ts";
import { computeOutstanding, groupOutstanding } from "../_shared/onboarding-outstanding.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const esc = (s: string) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

interface Payload {
  projectOnboardingId: string;
  recipients?: Array<"client" | "installer">;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const admin = createClient(supabaseUrl, serviceKey);

    // --- Auth: admins only ---
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) return json({ error: "Unauthorized" }, 401);

    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
    const actorId = userData.user.id;

    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: actorId, _role: "admin" });
    if (!isAdmin) return json({ error: "Admins only" }, 403);

    const body = (await req.json()) as Payload;
    const projectOnboardingId = body?.projectOnboardingId;
    const recipients = Array.isArray(body?.recipients) && body.recipients.length
      ? body.recipients.filter((r) => r === "client" || r === "installer")
      : (["client", "installer"] as const).slice();
    if (!projectOnboardingId) return json({ error: "projectOnboardingId is required" }, 400);

    // --- Load project data ---
    const { data: project, error: projErr } = await admin
      .from("project_onboarding")
      .select("id, proposal_id, data_access_verified, onboarding_complete, audit_ready")
      .eq("id", projectOnboardingId)
      .maybeSingle();
    if (projErr || !project) return json({ error: "Project onboarding not found" }, 404);

    const [{ data: fields }, { data: documents }, { data: proposal }] = await Promise.all([
      admin.from("onboarding_fields").select("*").eq("project_id", project.id).maybeSingle(),
      admin.from("onboarding_documents").select("category, file_name").eq("project_id", project.id),
      admin
        .from("proposals")
        .select("id, title, client_reference_id, content, agent_id")
        .eq("id", project.proposal_id)
        .maybeSingle(),
    ]);

    if (!proposal) return json({ error: "Proposal not found" }, 404);

    const outstanding = computeOutstanding(fields ?? null, documents ?? [], project);
    const grouped = groupOutstanding(outstanding);

    // --- Resolve recipients ---
    let clientName = "there";
    let clientEmail: string | null = null;
    if (proposal.client_reference_id) {
      const { data: client } = await admin
        .from("clients")
        .select("name, email")
        .eq("id", proposal.client_reference_id)
        .maybeSingle();
      if (client) {
        clientName = client.name || clientName;
        clientEmail = client.email || null;
      }
    }
    const content = (proposal.content ?? {}) as Record<string, any>;
    if (!clientEmail) clientEmail = content?.clientInfo?.email ?? null;
    if (clientName === "there" && content?.clientInfo?.name) clientName = content.clientInfo.name;

    const installerEmail = (fields?.installer_email as string | null) ?? null;
    const installerName = (fields?.installer_company_name as string | null) ?? "Installer";

    // --- Recent admin comments (for the deep link context) ---
    const { data: comments } = await admin
      .from("onboarding_comments")
      .select("content, created_at")
      .eq("project_id", project.id)
      .order("created_at", { ascending: false })
      .limit(3);

    const projectUrl = `${BROADCAST_BRAND.siteUrl}/onboarding/${project.id}`;
    const commentsUrl = `${projectUrl}?tab=activity`;
    const projectTitle = proposal.title || "your solar project";

    const checklistHtml = grouped.length
      ? grouped
          .map(
            (g) => `
        <p style="margin:16px 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;color:${BROADCAST_BRAND.ink}">${esc(g.section)}</p>
        <ul style="margin:0;padding-left:20px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${BROADCAST_BRAND.inkMuted};line-height:22px">
          ${g.labels.map((l) => `<li>${esc(l)}</li>`).join("")}
        </ul>`,
          )
          .join("")
      : `<p style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${BROADCAST_BRAND.inkMuted}">Everything we need has been received — thank you. No action required.</p>`;

    const commentsHtml = comments && comments.length
      ? `<p style="margin:20px 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;color:${BROADCAST_BRAND.ink}">Latest notes from our team</p>
         <ul style="margin:0;padding-left:20px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${BROADCAST_BRAND.inkMuted};line-height:22px">
           ${comments.map((c) => `<li>${esc(String(c.content).slice(0, 300))}</li>`).join("")}
         </ul>
         <p style="margin:10px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:14px">
           <a href="${commentsUrl}" style="color:${BROADCAST_BRAND.ink};text-decoration:underline">View and reply to comments</a>
         </p>`
      : "";

    const buildBody = (greetingName: string) => `
      <p style="margin:0 0 14px;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:${BROADCAST_BRAND.ink}">Hi ${esc(greetingName)},</p>
      <p style="margin:0 0 14px;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:${BROADCAST_BRAND.inkMuted};line-height:23px">
        We're finalising the onboarding pack for <strong>${esc(projectTitle)}</strong> so it can move to audit and start earning carbon credit revenue.
        ${outstanding.length ? "The following information is still outstanding:" : ""}
      </p>
      ${checklistHtml}
      ${commentsHtml}
      <p style="margin:24px 0 0">
        <a href="${projectUrl}" style="display:inline-block;background-color:${BROADCAST_BRAND.accent};color:${BROADCAST_BRAND.ink};font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;text-decoration:none;padding:12px 22px;border-radius:8px">Complete the outstanding items</a>
      </p>
      <p style="margin:18px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${BROADCAST_BRAND.inkMuted}">
        Reply to this email if anything is unclear — we're happy to help.
      </p>`;

    const subject = outstanding.length
      ? `Action needed: ${outstanding.length} outstanding item${outstanding.length === 1 ? "" : "s"} for ${projectTitle}`
      : `${projectTitle}: onboarding information complete`;

    const sendTo: Array<{ kind: "client" | "installer"; email: string; name: string }> = [];
    if (recipients.includes("client") && clientEmail) sendTo.push({ kind: "client", email: clientEmail, name: clientName });
    if (recipients.includes("installer") && installerEmail) sendTo.push({ kind: "installer", email: installerEmail, name: installerName });

    if (!sendTo.length) {
      return json({ error: "No email address available for the selected recipients", outstanding }, 400);
    }

    const results: Array<{ kind: string; email: string; ok: boolean; error?: string }> = [];
    for (const target of sendTo) {
      const html = renderBroadcastEmail({
        subject,
        preheader: outstanding.length ? `${outstanding.length} item(s) still needed for ${projectTitle}` : projectTitle,
        bodyHtml: buildBody(target.name),
      });
      const { error } = await resend.emails.send({
        from: "Crunch Carbon <hello@crunchcarbon.com>",
        to: [target.email],
        subject,
        html,
      });
      if (error) console.error(`Follow-up send failed for ${target.kind}:`, error);
      results.push({ kind: target.kind, email: target.email, ok: !error, error: error ? String((error as any).message ?? error) : undefined });
    }

    const sentKinds = results.filter((r) => r.ok).map((r) => r.kind);

    if (sentKinds.length) {
      await admin
        .from("project_onboarding")
        .update({
          last_followup_at: new Date().toISOString(),
          last_followup_by: actorId,
          last_followup_recipients: sentKinds,
        })
        .eq("id", project.id);

      await admin.from("onboarding_activity_log").insert({
        project_id: project.id,
        actor_id: actorId,
        action: "followup_sent",
        entity_type: "project_onboarding",
        entity_id: project.id,
        details: {
          recipients: sentKinds,
          emails: results.filter((r) => r.ok).map((r) => r.email),
          outstanding_count: outstanding.length,
        },
        new_value: `${outstanding.length} outstanding`,
      });
    }

    return json({
      success: sentKinds.length > 0,
      sent: results,
      outstanding_count: outstanding.length,
      outstanding: grouped,
    });
  } catch (err) {
    console.error("send-onboarding-followup error:", err);
    return json({ error: err instanceof Error ? err.message : "Unexpected error" }, 500);
  }
});
