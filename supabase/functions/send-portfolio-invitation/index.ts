// Portfolio invitation: one email covering many proposals for one client.
// Currently supports the admin-only SAMPLE preview (made-up data) for design review.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { z } from "npm:zod@3.23.8";
import { renderBrandEmail } from "../_shared/brand-email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

export const SAMPLE_SITES = [
  ["Northgate Mall", "Johannesburg, Gauteng", 8000],
  ["Riverside Mall Phase 2", "Vanderbijlpark, Gauteng", 3500],
  ["Eastern Cape Plaza", "Mthatha, Eastern Cape", 2200],
  ["Springfield Centre", "Springs, Gauteng", 1800],
  ["Harbour Walk", "Gqeberha, Eastern Cape", 1600],
  ["Limpopo Crossing", "Thohoyandou, Limpopo", 1400],
  ["Highveld Mall Phase 2", "Middelburg, Mpumalanga", 1300],
  ["Limpopo Crossing Phase 2", "Thohoyandou, Limpopo", 1300],
  ["Limpopo Retail Park", "Thohoyandou, Limpopo", 1152],
  ["Border Mall Phase 2", "Musina, Limpopo", 835],
  ["The Village Square", "Pretoria, Gauteng", 318],
  ["Parkside Centre", "Durban, KwaZulu-Natal", 300],
] as const;
// Indicative ZAR per kWp per year for the client (sample only).
const SAMPLE_RATE = 65;

const Body = z.object({ sample: z.literal(true), to: z.string().email().max(255) });

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const zar = (n: number) => "R " + Math.round(n).toLocaleString("en-ZA").replace(/,/g, " ");

function renderPortfolioEmail(p: { name: string; company: string; sites: { name: string; address: string; kwp: number; income: number }[]; link: string; declineLink: string; test: boolean }) {
  const totalKwp = p.sites.reduce((s, x) => s + x.kwp, 0);
  const totalIncome = p.sites.reduce((s, x) => s + x.income, 0);
  const mwp = (totalKwp / 1000).toFixed(1);
  const rows = p.sites.map((s, i) => `
    <tr style="background:${i % 2 ? "#FFFFFF" : "#FAFAFA"}">
      <td style="padding:8px 10px;font-size:13px;color:#1A1A1A"><strong>${esc(s.name)}</strong><br><span style="color:#5C5C5C;font-size:12px">${esc(s.address)}</span></td>
      <td align="right" style="padding:8px 10px;font-size:13px;white-space:nowrap">${s.kwp.toLocaleString("en-ZA")} kWp</td>
      <td align="right" style="padding:8px 10px;font-size:13px;white-space:nowrap">${zar(s.income)}</td>
    </tr>`).join("");
  const banner = p.test ? `<div style="background:#FFF4CC;border:1px dashed #1A1A1A;padding:10px 12px;border-radius:8px;font-size:12px;margin-bottom:16px"><strong>TEST – sample data.</strong> This is a design preview. The sites and figures below are made up.</div>` : "";
  const tile = (label: string, value: string) => `<td width="33%" style="padding:12px;border:1px solid #E6E6E6;border-radius:8px;text-align:center"><div style="font-size:11px;color:#5C5C5C;text-transform:uppercase;letter-spacing:.5px">${label}</div><div style="font-size:18px;font-weight:800;color:#1A1A1A;margin-top:4px">${value}</div></td>`;
  const bodyHtml = `<tr><td style="padding:8px 32px;font-family:Arial,Helvetica,sans-serif;color:#1A1A1A;line-height:1.6;font-size:14px">
    ${banner}
    <p>Hi ${esc(p.name)},</p>
    <p>Instead of ${p.sites.length} separate emails, here is your whole solar portfolio for <strong>${esc(p.company)}</strong> in one place. You review every site on one page and sign <strong>one</strong> Cession Agreement that covers them all.</p>
    <table role="presentation" width="100%" cellspacing="6" style="margin:12px 0"><tr>${tile("Sites", String(p.sites.length))}${tile("Capacity", mwp + " MWp")}${tile("Est. yearly income", zar(totalIncome))}</tr></table>
    <table role="presentation" width="100%" cellspacing="0" style="border:1px solid #E6E6E6;border-radius:8px;border-collapse:separate;font-family:Arial,Helvetica,sans-serif">
      <tr style="background:#1A1A1A;color:#FFFFFF"><td style="padding:8px 10px;font-size:12px">Site</td><td align="right" style="padding:8px 10px;font-size:12px">Size</td><td align="right" style="padding:8px 10px;font-size:12px">Est. yearly income</td></tr>
      ${rows}
    </table>
    <p style="font-size:12px;color:#5C5C5C;margin-top:12px">Carbon credits can be claimed from 1 July 2026 onwards, unless a site was part of an earlier audit round. Figures are estimates.</p>
  </td></tr>`;
  return {
    subject: `${p.test ? "[TEST] " : ""}Your solar portfolio: ${p.sites.length} sites, ${mwp} MWp`,
    html: renderBrandEmail({
      preheader: `${p.sites.length} sites, ${mwp} MWp — review and sign once.`,
      heading: `Your solar portfolio: ${p.sites.length} sites, ${mwp} MWp`,
      bodyHtml,
      ctaLabel: "Review & sign portfolio",
      ctaHref: p.link,
      footerNote: `Not interested? <a href="${p.declineLink}" style="color:#5C5C5C">Decline this portfolio</a>.`,
    }),
  };
}

const LiveBody = z.object({
  proposalIds: z.array(z.string().uuid()).min(2).max(500),
  ccEmails: z.array(z.string().trim().email().max(255)).max(10).optional(),
});

const SIGNABLE = ["draft", "sent", "delivered", "opened", "viewed", "stale"];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "No authorization header" }, 401);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const bearer = auth.replace("Bearer ", "");
    const isSystem = bearer === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    let userId: string | null = null;
    let role: string | null = isSystem ? "admin" : null;
    if (!isSystem) {
      const { data: { user } } = await admin.auth.getUser(bearer);
      if (!user) return json({ error: "Invalid token" }, 401);
      userId = user.id;
      const { data: r } = await admin.rpc("get_primary_role", { _user_id: user.id });
      role = r as string;
    }

    const raw = await req.json();
    const key = Deno.env.get("RESEND_API_KEY");
    if (!key) return json({ error: "RESEND_API_KEY not configured" }, 500);
    const resend = new Resend(key);
    const site = Deno.env.get("SITE_URL") || "https://crunchcarbon.com";

    // ---- Sample preview (admin only) ----
    if (raw?.sample === true) {
      if (role !== "admin") return json({ error: "Admin access required" }, 403);
      const parsed = Body.safeParse(raw);
      if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
      const email = renderPortfolioEmail({
        name: "Shaun",
        company: "Sample Property Group (Pty) Ltd",
        sites: SAMPLE_SITES.map(([name, address, kwp]) => ({ name, address, kwp, income: kwp * SAMPLE_RATE })),
        link: `${site}/portfolio/demo`,
        declineLink: `${site}/portfolio/demo`,
        test: true,
      });
      const res = await resend.emails.send({ from: "Crunch Carbon <proposals@crunchcarbon.com>", to: [parsed.data.to], subject: email.subject, html: email.html });
      if (res.error) return json({ error: "Email provider rejected the send", details: res.error }, 502);
      return json({ success: true, messageId: res.data?.id });
    }

    // ---- Live portfolio send (admin, or partner who owns every proposal) ----
    if (role !== "admin" && role !== "agent" && role !== "super_partner") return json({ error: "Not allowed" }, 403);
    const parsed = LiveBody.safeParse(raw);
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
    const ids = [...new Set(parsed.data.proposalIds)];

    const { data: rows, error } = await admin
      .from("proposals")
      .select("id, title, status, signed_at, agent_id, client_reference_id, system_size_kwp, invitation_token, invitation_expires_at, content, deleted_at, archived_at")
      .in("id", ids);
    if (error) throw error;
    if (!rows || rows.length !== ids.length) return json({ error: "Some proposals could not be found" }, 404);
    if (role !== "admin" && rows.some((r) => r.agent_id !== userId)) return json({ error: "You can only send your own proposals" }, 403);
    const clientIds = new Set(rows.map((r) => r.client_reference_id));
    if (clientIds.size !== 1 || !rows[0].client_reference_id) return json({ error: "All selected proposals must belong to the same client" }, 400);
    const bad = rows.filter((r) => r.signed_at || r.deleted_at || r.archived_at || !SIGNABLE.includes(r.status));
    if (bad.length) return json({ error: `${bad.length} selected proposal(s) are already signed, archived or not sendable` }, 400);

    const { data: client } = await admin.from("clients").select("first_name, last_name, email, company_name").eq("id", rows[0].client_reference_id).maybeSingle();
    const firstInfo = (rows[0].content as any)?.clientInfo || {};
    const to = String(client?.email || firstInfo.email || "").trim().toLowerCase();
    if (!to) return json({ error: "The client has no email address" }, 400);
    const { data: suppressed } = await admin.rpc("is_client_email_suppressed", { p_email: to });
    if (suppressed) return json({ error: "The client's email address is on the blocked list (it bounced before)" }, 400);
    const cc: string[] = [];
    for (const e of parsed.data.ccEmails ?? []) {
      const l = e.toLowerCase();
      if (l === to || cc.includes(l)) continue;
      const { data: s } = await admin.rpc("is_client_email_suppressed", { p_email: l });
      if (!s) cc.push(l);
    }

    // Every proposal gets a valid signing link; signing any one covers all (propagate_master_agreement).
    const expires = new Date(Date.now() + 60 * 86400000).toISOString();
    for (const r of rows) {
      const valid = r.invitation_token && r.invitation_expires_at && new Date(r.invitation_expires_at) > new Date();
      if (!valid) {
        r.invitation_token = crypto.randomUUID();
        const { error: e } = await admin.from("proposals").update({ invitation_token: r.invitation_token, invitation_expires_at: expires }).eq("id", r.id);
        if (e) throw e;
      }
    }
    const sorted = [...rows].sort((a, b) => (b.system_size_kwp ?? 0) - (a.system_size_kwp ?? 0));
    const lead = sorted[0];
    const sites = sorted.map((r) => {
      const c: any = r.content || {};
      const byYear: Record<string, number> = c.clientSpecificRevenue || {};
      const years = Object.values(byYear).filter((v) => typeof v === "number" && v > 0).length;
      const total = c?.financials?.totalClientRevenue;
      return {
        name: c?.projectInfo?.name || r.title || "Site",
        address: c?.projectInfo?.address || "",
        kwp: Math.round(r.system_size_kwp ?? 0),
        income: typeof total === "number" && years > 0 ? total / years : 0,
      };
    });
    const name = String(client?.first_name || firstInfo.name || "there").split(" ")[0];
    const company = client?.company_name || firstInfo.companyName || [client?.first_name, client?.last_name].filter(Boolean).join(" ") || "your company";
    const email = renderPortfolioEmail({
      name, company, sites,
      link: `${site}/proposals/${lead.id}/accept?token=${lead.invitation_token}&portfolio=${rows.length}`,
      declineLink: `${site}/proposals/${lead.id}/decline?token=${lead.invitation_token}`,
      test: false,
    });

    let agentEmail: string | undefined;
    if (lead.agent_id) {
      const { data: ap } = await admin.from("profiles").select("email").eq("id", lead.agent_id).maybeSingle();
      agentEmail = ap?.email || undefined;
    }
    const res = await resend.emails.send({
      from: "Crunch Carbon <proposals@crunchcarbon.com>",
      to: [to],
      cc: cc.length ? cc : undefined,
      bcc: agentEmail && agentEmail !== to ? [agentEmail] : undefined,
      subject: email.subject,
      html: email.html,
    });
    if (res.error) return json({ error: "Email provider rejected the send", details: res.error }, 502);

    const now = new Date().toISOString();
    await admin.from("proposals").update({ status: "sent", last_email_event_type: "email.sent", last_email_sent_at: now }).in("id", ids).eq("status", "draft");
    await admin.from("proposal_automation_log").insert(rows.map((r) => ({
      proposal_id: r.id,
      automation_type: "email_sent",
      email_type: "portfolio_invite",
      email_message_id: r.id === lead.id ? res.data?.id : null,
      details: { recipient: to, cc: cc.length ? cc : undefined, portfolio_size: rows.length, lead_proposal_id: lead.id, sent_by: userId },
    })));

    return json({ success: true, messageId: res.data?.id, recipient: to, sites: rows.length });
  } catch (e) {
    console.error("[send-portfolio-invitation]", e);
    return json({ error: (e as Error).message }, 500);
  }
});
