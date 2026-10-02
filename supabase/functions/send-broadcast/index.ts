import "../_shared/sandbox.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { buildUnsubscribe, policyFor, renderMergeTags } from "../_shared/broadcast.ts";
import { renderBroadcastEmail } from "../_shared/broadcast-template.ts";

// Broadcast sender.
//  - Resolves the audience at send time (never a frozen list).
//  - Gated by is_client_email_suppressed + the category preference gate.
//    Deliberately NEVER by can_send_client_email: a proposal follow-up must not
//    silently drop an announcement.
//  - Paced under the Resend API limit of 2 requests/second.
//  - Resumable (re-invocation processes only pending rows) and cancellable.

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const REQUEST_INTERVAL_MS = 600; // ~1.67 req/s, under the 2 req/s API limit
const TIME_BUDGET_MS = 90_000; // hand off to a fresh invocation after this
const MAX_429_RETRIES = 5;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface RecipientRow {
  id: string;
  email: string;
  recipient_name: string | null;
  context: Record<string, any>;
}

async function sendOne(
  apiKey: string,
  payload: Record<string, unknown>,
): Promise<{ id?: string; error?: string; retryable?: boolean }> {
  let attempt = 0;
  let backoff = 1000;

  while (true) {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.status === 429) {
      attempt++;
      if (attempt > MAX_429_RETRIES) return { error: "Rate limited by Resend", retryable: true };
      const retryAfter = Number(res.headers.get("retry-after") ?? 0) * 1000;
      await sleep(Math.max(retryAfter, backoff));
      backoff *= 2;
      continue;
    }

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { error: json?.message ?? `Resend returned ${res.status}` };
    }
    return { id: json?.id };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const admin = createClient(supabaseUrl, serviceKey);

  try {
    if (!resendKey) throw new Error("RESEND_API_KEY is not configured");

    const body = await req.json().catch(() => ({}));
    const campaignId: string = body?.campaign_id;
    const testTo: string | null = body?.test_to ?? null;
    const excludeEmails: string[] = (body?.exclude_emails ?? []).map((e: string) =>
      String(e).toLowerCase().trim(),
    );
    const isContinuation = body?.__continuation === true;

    if (!campaignId) throw new Error("campaign_id is required");

    // Continuations authenticate with the service role key; user calls must be admin.
    if (!isContinuation) {
      const caller = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
      });
      const { data: isAdmin } = await caller.rpc("is_current_user_admin");
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Admin access required" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { data: campaign, error: campaignError } = await admin
      .from("broadcast_campaigns")
      .select("*")
      .eq("id", campaignId)
      .maybeSingle();

    if (campaignError || !campaign) throw new Error("Campaign not found");

    const policy = policyFor(campaign.category);

    // Canonical broadcast identity. Legacy partners@ rows are corrected here so a
    // stale draft can never send from the wrong address.
    const fromName = campaign.from_name || "Crunch Carbon";
    const fromEmail = String(campaign.from_email || "").toLowerCase().startsWith("partners@")
      ? "hello@updates.crunchcarbon.com"
      : campaign.from_email;
    const replyTo = String(campaign.reply_to || "").toLowerCase().startsWith("partners@")
      ? "hello@crunchcarbon.com"
      : campaign.reply_to;

    // ------------------------------------------------------------- attachments
    // Opt-in escape hatch. Files live in the PRIVATE broadcast-documents bucket and
    // are downloaded once here with the service role, then reused for every send.
    const MAX_ATTACHMENT_TOTAL_BYTES = 5 * 1024 * 1024;
    const attachmentSpecs: Array<{ path: string; name: string; size?: number }> = Array.isArray(
      campaign.attachments,
    )
      ? campaign.attachments
      : [];

    let resendAttachments: Array<{ filename: string; content: string }> | undefined;

    if (attachmentSpecs.length > 0) {
      const declared = attachmentSpecs.reduce((s, a) => s + Number(a.size ?? 0), 0);
      if (declared > MAX_ATTACHMENT_TOTAL_BYTES) {
        throw new Error("Attachments exceed the 5 MB total limit");
      }
      resendAttachments = [];
      for (const spec of attachmentSpecs) {
        const { data: blob, error: dlError } = await admin.storage
          .from("broadcast-documents")
          .download(spec.path);
        if (dlError || !blob) throw new Error(`Attachment missing in storage: ${spec.name}`);
        const bytes = new Uint8Array(await blob.arrayBuffer());
        let binary = "";
        for (let i = 0; i < bytes.length; i += 8192) {
          binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
        }
        resendAttachments.push({ filename: spec.name, content: btoa(binary) });
      }
    }

    const buildPayload = async (r: {
      email: string;
      recipient_name: string | null;
      context: Record<string, any>;
    }) => {
      const unsub = await buildUnsubscribe(campaign.category, campaign.id, r.email);
      const merged = renderMergeTags(campaign.body_html, r);
      return {
        from: `${fromName} <${fromEmail}>`,
        to: [r.email],
        reply_to: replyTo,
        subject: renderMergeTags(campaign.subject, r),
        // Every send — test and real — goes through the same branded wrapper.
        html: renderBroadcastEmail({
          subject: renderMergeTags(campaign.subject, r),
          preheader: campaign.preheader,
          bodyHtml: merged,
          unsubscribeUrl: unsub.url,
        }),
        headers: unsub.headers,
        ...(resendAttachments?.length ? { attachments: resendAttachments } : {}),
      };
    };

    // ---------------------------------------------------------------- test send
    // Bypasses the exclusion list, suppression and preferences entirely.
    if (testTo) {
      const payload = await buildPayload({
        email: testTo.toLowerCase().trim(),
        recipient_name: "Test recipient",
        context: {
          projects: [
            { title: "Example Project A", stage: "audit_ready" },
            { title: "Example Project B", stage: "in_progress" },
          ],
        },
      });
      const result = await sendOne(resendKey, payload);
      if (result.error) throw new Error(result.error);
      return new Response(JSON.stringify({ test_send: true, message_id: result.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (campaign.status === "cancelled") {
      return new Response(JSON.stringify({ status: "cancelled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (campaign.status === "sent") {
      return new Response(JSON.stringify({ status: "sent", already_complete: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ------------------------------------------------- materialise the recipients
    const { count: existingCount } = await admin
      .from("broadcast_recipients")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaignId);

    if (!existingCount) {
      const { data: resolved, error: resolveError } = await admin.rpc(
        "resolve_broadcast_audience",
        { p_audience: campaign.audience },
      );
      if (resolveError) throw new Error(`Audience resolution failed: ${resolveError.message}`);

      const rows = (resolved ?? [])
        .filter((r: any) => !excludeEmails.includes(String(r.email).toLowerCase()))
        .map((r: any) => ({
          campaign_id: campaignId,
          email: r.email,
          recipient_name: r.recipient_name,
          user_id: r.user_id,
          client_id: r.client_id,
          context: r.context ?? {},
          status: "pending",
        }));

      if (rows.length === 0) throw new Error("Audience resolved to zero recipients");

      for (let i = 0; i < rows.length; i += 500) {
        const { error: insertError } = await admin
          .from("broadcast_recipients")
          .insert(rows.slice(i, i + 500));
        if (insertError) throw insertError;
      }

      await admin
        .from("broadcast_campaigns")
        .update({
          status: "sending",
          started_at: new Date().toISOString(),
          total_recipients: rows.length,
          last_error: null,
        })
        .eq("id", campaignId);
    } else if (campaign.status !== "sending") {
      await admin
        .from("broadcast_campaigns")
        .update({ status: "sending", started_at: campaign.started_at ?? new Date().toISOString() })
        .eq("id", campaignId);
    }

    // ------------------------------------------------------------------ send loop
    const startedAt = Date.now();
    let sent = 0;
    let failed = 0;
    let skipped = 0;
    let handedOff = false;

    while (true) {
      // Cancellation is checked between batches.
      const { data: current } = await admin
        .from("broadcast_campaigns")
        .select("status")
        .eq("id", campaignId)
        .maybeSingle();
      if (current?.status === "cancelled") break;

      const { data: batch } = await admin
        .from("broadcast_recipients")
        .select("id,email,recipient_name,context")
        .eq("campaign_id", campaignId)
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .limit(50);

      const pending = (batch ?? []) as RecipientRow[];
      if (pending.length === 0) break;

      for (const recipient of pending) {
        if (Date.now() - startedAt > TIME_BUDGET_MS) {
          handedOff = true;
          break;
        }

        // Hard opt-outs (bounce, complaint, all-mail unsubscribe) apply to every category.
        const { data: suppressed } = await admin.rpc("is_client_email_suppressed", {
          p_email: recipient.email,
        });
        if (suppressed) {
          await admin
            .from("broadcast_recipients")
            .update({ status: "skipped_suppressed", skip_reason: "suppression_list" })
            .eq("id", recipient.id);
          skipped++;
          continue;
        }

        // Category gate — operational mail never consults preferences.
        if (policy.respectsPreferences) {
          const { data: pref } = await admin
            .from("broadcast_preferences")
            .select("id")
            .ilike("email", recipient.email)
            .eq("category", campaign.category)
            .maybeSingle();
          if (pref) {
            await admin
              .from("broadcast_recipients")
              .update({ status: "skipped_opted_out", skip_reason: "category_opt_out" })
              .eq("id", recipient.id);
            skipped++;
            continue;
          }
        }

        const payload = await buildPayload(recipient);
        const result = await sendOne(resendKey, payload);

        if (result.error) {
          await admin
            .from("broadcast_recipients")
            .update({
              status: result.retryable ? "pending" : "failed",
              error: result.error,
            })
            .eq("id", recipient.id);
          if (result.retryable) {
            handedOff = true;
            break;
          }
          failed++;
        } else {
          await admin
            .from("broadcast_recipients")
            .update({
              status: "sent",
              message_id: result.id ?? null,
              sent_at: new Date().toISOString(),
            })
            .eq("id", recipient.id);
          sent++;
        }

        await sleep(REQUEST_INTERVAL_MS);
      }

      if (handedOff) break;
    }

    // --------------------------------------------------------------- roll up state
    const counts = async (status: string) => {
      const { count } = await admin
        .from("broadcast_recipients")
        .select("id", { count: "exact", head: true })
        .eq("campaign_id", campaignId)
        .eq("status", status);
      return count ?? 0;
    };

    const [sentTotal, failedTotal, skippedSup, skippedOpt, pendingTotal] = await Promise.all([
      counts("sent"),
      counts("failed"),
      counts("skipped_suppressed"),
      counts("skipped_opted_out"),
      counts("pending"),
    ]);

    const { data: latest } = await admin
      .from("broadcast_campaigns")
      .select("status")
      .eq("id", campaignId)
      .maybeSingle();

    const isCancelled = latest?.status === "cancelled";
    const complete = pendingTotal === 0 && !isCancelled;

    await admin
      .from("broadcast_campaigns")
      .update({
        status: isCancelled ? "cancelled" : complete ? "sent" : "sending",
        sent_count: sentTotal,
        failed_count: failedTotal,
        skipped_count: skippedSup + skippedOpt,
        completed_at: complete ? new Date().toISOString() : null,
      })
      .eq("id", campaignId);

    // Resume in a fresh invocation if work remains.
    if (!complete && !isCancelled && pendingTotal > 0) {
      fetch(`${supabaseUrl}/functions/v1/send-broadcast`, {
        method: "POST",
        headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ campaign_id: campaignId, __continuation: true }),
      }).catch((e) => console.error("[send-broadcast] continuation failed", e?.message));
    }

    return new Response(
      JSON.stringify({
        campaign_id: campaignId,
        status: isCancelled ? "cancelled" : complete ? "sent" : "sending",
        this_run: { sent, failed, skipped },
        totals: {
          sent: sentTotal,
          failed: failedTotal,
          skipped: skippedSup + skippedOpt,
          pending: pendingTotal,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("[send-broadcast] error", error?.message);
    return new Response(JSON.stringify({ error: error?.message ?? "Unexpected error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
