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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "No authorization header" }, 401);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const bearer = auth.replace("Bearer ", "");
    // System callers (service role) are trusted for the sample preview.
    if (bearer !== Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") && bearer !== (Deno.env.get("SWEEP_CRON_SECRET") ?? "__none__")) {
      const { data: { user } } = await admin.auth.getUser(bearer);
      if (!user) return json({ error: "Invalid token" }, 401);
      const { data: role } = await admin.rpc("get_primary_role", { _user_id: user.id });
      if (role !== "admin") return json({ error: "Admin access required" }, 403);
    }

    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);

    const key = Deno.env.get("RESEND_API_KEY");
    if (!key) return json({ error: "RESEND_API_KEY not configured" }, 500);
    const site = "https://crunchcarbon.com";
    const email = renderPortfolioEmail({
      name: "Shaun",
      company: "Sample Property Group (Pty) Ltd",
      sites: SAMPLE_SITES.map(([name, address, kwp]) => ({ name, address, kwp, income: kwp * SAMPLE_RATE })),
      link: `${site}/portfolio/demo`,
      declineLink: `${site}/portfolio/demo`,
      test: true,
    });
    const res = await new Resend(key).emails.send({
      from: "Crunch Carbon <proposals@crunchcarbon.com>",
      to: [parsed.data.to],
      subject: email.subject,
      html: email.html,
    });
    if (res.error) return json({ error: "Email provider rejected the send", details: res.error }, 502);
    return json({ success: true, messageId: res.data?.id });
  } catch (e) {
    console.error("[send-portfolio-invitation]", e);
    return json({ error: (e as Error).message }, 500);
  }
});
