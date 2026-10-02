import "../_shared/sandbox.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";
import { renderBrandEmail, brandCard } from "../_shared/brand-email.ts";
import { getCarbonPrices } from "../_shared/carbonPricing.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const Body = z.object({
  proposalId: z.string().uuid(),
});

const ANNUAL_GENERATION_FACTOR = 1642.5; // kWh / kWp / year
const CARBON_FACTOR = 1.0334;             // tCO₂ / MWh

function ZAR(n: number) {
  return "R " + Math.round(n).toLocaleString("en-ZA");
}

function annualRevenueForKWp(
  kwp: number,
  sharePct: number,
  prices: Record<string, number>,
): number {
  const annualEnergyKWh = kwp * ANNUAL_GENERATION_FACTOR;
  const credits = (annualEnergyKWh / 1000) * CARBON_FACTOR;
  const currentYear = new Date().getFullYear();
  const price = prices[String(currentYear)] ?? prices[String(currentYear + 1)] ?? 130;
  return credits * price * (sharePct / 100);
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Invalid request" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { proposalId } = parsed.data;

    // 1. Load proposal + onboarding row for installer details
    const { data: proposal } = await admin
      .from("proposals")
      .select("id, title, agent_id, system_size_kwp, content, client_reference_id")
      .eq("id", proposalId)
      .maybeSingle();
    if (!proposal) {
      return new Response(JSON.stringify({ error: "Proposal not found" }), { status: 404, headers: corsHeaders });
    }

    const { data: onboardingRow } = await admin
      .from("project_onboarding")
      .select("id")
      .eq("proposal_id", proposalId)
      .maybeSingle();
    if (!onboardingRow) {
      console.warn("[installer-invite] no project_onboarding row for proposal", proposalId);
      return new Response(JSON.stringify({ ok: false, reason: "no_onboarding" }), { status: 200, headers: corsHeaders });
    }

    const { data: fields } = await admin
      .from("onboarding_fields")
      .select("installer_company_name, installer_email, installer_id")
      .eq("project_id", onboardingRow.id)
      .maybeSingle();

    const installerEmailRaw = fields?.installer_email?.trim().toLowerCase();
    const installerCompany = (fields?.installer_company_name || "").trim();
    if (!installerEmailRaw) {
      return new Response(JSON.stringify({ ok: false, reason: "no_installer_email" }), { status: 200, headers: corsHeaders });
    }

    // 2. Look up or create installer
    const { data: existingInstaller } = await admin
      .from("solar_installers")
      .select("id, company_name, email")
      .ilike("email", installerEmailRaw)
      .maybeSingle();

    let installerId = existingInstaller?.id ?? null;
    const isNewInstaller = !existingInstaller;

    if (isNewInstaller) {
      const { data: created, error: createErr } = await admin
        .from("solar_installers")
        .insert({
          email: installerEmailRaw,
          company_name: installerCompany || installerEmailRaw,
          created_by: proposal.agent_id,
        })
        .select("id")
        .single();
      if (createErr || !created) {
        console.error("[installer-invite] insert failed", createErr);
      } else {
        installerId = created.id;
      }
    }

    if (installerId && fields?.installer_id !== installerId) {
      await admin
        .from("onboarding_fields")
        .update({ installer_id: installerId })
        .eq("project_id", onboardingRow.id);
    }

    // 3. Client name for personalised wording
    let clientName = "your client";
    if (proposal.client_reference_id) {
      const { data: c } = await admin
        .from("clients")
        .select("first_name, last_name, company_name")
        .eq("id", proposal.client_reference_id)
        .maybeSingle();
      if (c) {
        clientName =
          c.company_name?.trim() ||
          [c.first_name, c.last_name].filter(Boolean).join(" ") ||
          clientName;
      }
    }

    // 4. Commission %
    const { data: commissionSetting } = await admin
      .from("system_settings")
      .select("setting_value")
      .eq("setting_key", "installer_commission_percentage")
      .maybeSingle();
    const commissionPct = Number(commissionSetting?.setting_value ?? 4);

    // 5. Worked examples
    const prices = await getCarbonPrices(admin);
    const example100 = annualRevenueForKWp(100, commissionPct, prices);
    const example1MW = annualRevenueForKWp(1000, commissionPct, prices);

    // 6. Email
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ ok: true, skipped_email: true, installerId }), {
        status: 200,
        headers: corsHeaders,
      });
    }

    const origin = req.headers.get("origin") || "https://crunchcarbon.com";
    let html: string;
    let subject: string;

    if (isNewInstaller) {
      const examplesCard = brandCard([
        [`100 kWp system @ ${commissionPct}%`, `≈ ${ZAR(example100)} / year`],
        [`1 MWp portfolio @ ${commissionPct}%`, `≈ ${ZAR(example1MW)} / year`],
      ]);

      const body = `
        <p>Hi there,</p>
        <p><strong>${clientName.replace(/[<>]/g, "")}</strong> just signed up with Crunch Carbon to start
        earning carbon credits from their solar system — and they listed
        <strong>${(installerCompany || installerEmailRaw).replace(/[<>]/g, "")}</strong>
        as their installer.</p>

        <p>We'd love to invite you to join the Crunch Carbon installer programme. When you
        help us complete the technical onboarding for your client's project (panels, inverter
        serials, meter info, etc.), you earn a <strong>${commissionPct}% annuity</strong> on the
        carbon revenue that project generates — every year, for the life of the project.</p>

        <p style="margin-bottom:6px"><strong>What that looks like at today's carbon prices:</strong></p>
        ${examplesCard}

        <p>And it scales — the more installs you bring across, the bigger your recurring annuity
        becomes. You can also send us new client referrals directly from your installer dashboard.</p>

        <p>Click below to accept the invitation, complete this client's project details, and set
        up your installer profile.</p>
      `;

      html = renderBrandEmail({
        preheader: `Earn a ${commissionPct}% annuity on every solar system you complete with Crunch Carbon`,
        heading: `You've been invited to join Crunch Carbon`,
        bodyHtml: body,
        ctaLabel: "Accept invitation & complete client onboarding",
        ctaHref: `${origin}/onboarding?proposal=${proposalId}`,
        footerNote: `Worked examples assume ${ANNUAL_GENERATION_FACTOR} kWh/kWp/year, ${CARBON_FACTOR} tCO₂/MWh and the current carbon credit price. Actual earnings depend on real meter data.`,
        signOff: "The Crunch Carbon Team",
      });
      subject = `${clientName} listed you as their installer — earn a ${commissionPct}% annuity`;
    } else {
      const body = `
        <p>Hi ${(existingInstaller?.company_name || "there").replace(/[<>]/g, "")},</p>
        <p>Good news — <strong>${clientName.replace(/[<>]/g, "")}</strong> just signed their
        Crunch Carbon cession agreement and listed you as their installer.</p>
        <p>The next step is the technical project onboarding (system address, panels, inverter
        serials, meter info and costs). Once that's done, the project becomes eligible for
        carbon credit revenue — and your <strong>${commissionPct}% annuity</strong> kicks in
        each year for the life of the project.</p>
        <p>Tap the button below to open this project and complete the onboarding details.</p>
      `;

      html = renderBrandEmail({
        preheader: `${clientName} needs you to complete project onboarding`,
        heading: `${clientName} just signed — help complete onboarding`,
        bodyHtml: body,
        ctaLabel: "Open project & complete onboarding",
        ctaHref: `${origin}/onboarding?proposal=${proposalId}`,
        signOff: "The Crunch Carbon Team",
      });
      subject = `${clientName} signed — please complete project onboarding`;
    }

    let messageId: string | null = null;
    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Crunch Carbon <installers@crunchcarbon.com>",
          to: [installerEmailRaw],
          subject,
          html,
        }),
      });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) console.error("[installer-invite] resend failed", r.status, json);
      messageId = (json as { id?: string })?.id ?? null;
    } catch (e) {
      console.error("[installer-invite] resend error", e);
    }

    await admin.from("proposal_automation_log").insert({
      proposal_id: proposalId,
      automation_type: isNewInstaller ? "installer_invitation" : "installer_notification",
      trigger_event: "proposal_signed",
      email_type: isNewInstaller ? "installer_invitation" : "installer_notification",
      email_message_id: messageId,
      details: { installer_id: installerId, installer_email: installerEmailRaw, commissionPct },
    });

    return new Response(JSON.stringify({ ok: true, installerId, isNewInstaller }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-installer-invitation error", e);
    return new Response(JSON.stringify({ error: "Unexpected error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
