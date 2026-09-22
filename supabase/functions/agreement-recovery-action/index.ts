// Admin-only actions for the temporary Agreement Recovery page.
//
// Three situations are handled:
//   A — signature on record, document never produced -> rebuild (optionally email)
//   B — marked signed, no signature on record        -> fresh signing link
//   C — marked signed, no agreement at all           -> fresh signing link
//
// Every action is recorded against the client's recovery row so the page
// doubles as the audit record of the exercise.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { Resend } from "npm:resend@2.0.0";
import { renderBrandEmail } from "../_shared/brand-email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const LINK_VALID_DAYS = 60;

type Action = "fix_documents" | "issue_link" | "mark_handled";

interface Payload {
  action: Action;
  itemIds: string[];
  sendEmail?: boolean;
  note?: string;
  // Optional extra addresses that should also receive the apology email
  // (e.g. the colleague address that historically received the proposals).
  alsoEmail?: string[];
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface RecoveryItem {
  id: string;
  client_id: string;
  client_name: string | null;
  client_email: string | null;
  group_code: string;
  project_count: number;
  proposal_ids: string[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const bearer =
      req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
    if (!bearer) return json({ error: "Authentication required" }, 401);

    // The service-role key is accepted as a system caller (used by ops tasks
    // where no admin browser session exists). Everyone else must be an admin.
    let actorId: string | null = null;
    if (bearer !== serviceKey) {
      const {
        data: { user },
      } = await admin.auth.getUser(bearer);
      if (!user) return json({ error: "Authentication required" }, 401);

      const { data: isAdmin } = await admin.rpc("has_role", {
        _user_id: user.id,
        _role: "admin",
      });
      if (!isAdmin) return json({ error: "Administrators only" }, 403);
      actorId = user.id;
    }

    const body = (await req.json().catch(() => ({}))) as Partial<Payload>;
    const action = body.action;
    const itemIds = Array.isArray(body.itemIds)
      ? body.itemIds.slice(0, 100)
      : [];
    const sendEmail = body.sendEmail !== false;
    const note = typeof body.note === "string" ? body.note.slice(0, 500) : null;
    const alsoEmail = Array.isArray(body.alsoEmail)
      ? body.alsoEmail
          .filter((e) => typeof e === "string" && EMAIL_RE.test(e.trim()))
          .map((e) => e.trim().toLowerCase())
          .slice(0, 5)
      : [];

    if (
      !action ||
      !["fix_documents", "issue_link", "mark_handled"].includes(action)
    ) {
      return json({ error: "Unknown action" }, 400);
    }
    if (itemIds.length === 0) {
      return json({ error: "Select at least one client" }, 400);
    }

    const { data: items, error: itemsError } = await admin
      .from("agreement_recovery_items")
      .select(
        "id, client_id, client_name, client_email, group_code, project_count, proposal_ids",
      )
      .in("id", itemIds);

    if (itemsError) return json({ error: itemsError.message }, 500);
    if (!items?.length) return json({ error: "No matching clients" }, 404);

    const siteUrl = Deno.env.get("SITE_URL") || "https://crunchcarbon.com";
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const resend = resendKey ? new Resend(resendKey) : null;

    const results: Array<Record<string, unknown>> = [];

    for (const item of items as RecoveryItem[]) {
      try {
        if (action === "mark_handled") {
          await setState(
            admin,
            item,
            "handled",
            "mark_handled",
            actorId,
            {
              note,
            },
            note,
          );
          results.push({ itemId: item.id, ok: true, state: "handled" });
          continue;
        }

        if (action === "fix_documents") {
          const { data: sweep, error: sweepError } =
            await admin.functions.invoke("sweep-agreement-documents", {
              body: { clientId: item.client_id, limit: 100, sendEmail },
            });
          if (sweepError) throw new Error(sweepError.message);

          await setState(
            admin,
            item,
            "fixed",
            sendEmail ? "fix_documents_emailed" : "fix_documents_silent",
            actorId,
            {
              processed: sweep?.processed ?? 0,
              failures: sweep?.failures ?? [],
            },
            note,
          );
          results.push({
            itemId: item.id,
            ok: true,
            state: "fixed",
            processed: sweep?.processed ?? 0,
          });
          continue;
        }

        // issue_link (Groups B and C)
        const proposalId = await nominateProposal(admin, item);
        if (!proposalId) throw new Error("No project available to sign");

        const token = crypto.randomUUID();
        const expiresAt = new Date(
          Date.now() + LINK_VALID_DAYS * 24 * 60 * 60 * 1000,
        ).toISOString();

        const requestedAt = new Date().toISOString();

        const { error: tokenError } = await admin
          .from("proposals")
          .update({
            invitation_token: token,
            invitation_expires_at: expiresAt,
            resign_required: true,
            resign_requested_at: requestedAt,
          })
          .eq("id", proposalId);
        if (tokenError) throw new Error(tokenError.message);

        // One signature must cover the client. Flag every outstanding project
        // so no link of theirs is ever refused as "already signed".
        const siblingIds = (item.proposal_ids ?? []).filter(
          (id) => id !== proposalId,
        );
        if (siblingIds.length > 0) {
          await admin
            .from("proposals")
            .update({
              resign_required: true,
              resign_requested_at: requestedAt,
            })
            .in("id", siblingIds);
        }

        const link = `${siteUrl}/proposals/${proposalId}/accept?token=${token}`;

        let emailed = false;
        let skipReason: string | null = null;
        const messageIds: string[] = [];

        if (sendEmail) {
          const primary = item.client_email?.trim().toLowerCase();
          const recipients = [...new Set([primary, ...alsoEmail])].filter(
            (e): e is string => !!e,
          );

          if (recipients.length === 0) {
            skipReason = "no email address on record";
          } else if (!resend) {
            skipReason = "email service not configured";
          } else {
            for (const email of recipients) {
              const { data: suppressed } = await admin.rpc(
                "is_client_email_suppressed",
                { p_email: email },
              );
              if (suppressed) {
                if (email === primary)
                  skipReason = "address is on the blocked list";
                continue;
              }

              const sendResult = await resend.emails.send({
                from: "Crunch Carbon <noreply@crunchcarbon.com>",
                to: [email],
                subject: "Action needed: your Cession Agreement",
                html: buildApologyEmail(
                  item.client_name || "there",
                  item.project_count,
                  link,
                ),
                text: buildApologyText(
                  item.client_name || "there",
                  item.project_count,
                  link,
                ),
              });
              if ((sendResult as any)?.error) {
                throw new Error(JSON.stringify((sendResult as any).error));
              }

              const messageId = (sendResult as any)?.data?.id as
                | string
                | undefined;
              if (messageId) {
                messageIds.push(messageId);
                // Registering the send makes delivery, opens and bounces flow
                // back through the existing Resend webhook.
                await admin.from("proposal_automation_log").insert({
                  proposal_id: proposalId,
                  automation_type: "agreement_recovery",
                  trigger_event: "resign_request",
                  email_type: "cession_resign_apology",
                  email_message_id: messageId,
                  details: { recipient: email, recovery_item_id: item.id },
                  created_by: actorId,
                });
              }
              emailed = true;
              if (email === primary) skipReason = null;
            }

            if (!emailed && !skipReason) {
              skipReason = "no deliverable address";
            }
          }
        }

        await admin
          .from("agreement_recovery_items")
          .update({
            link_proposal_id: proposalId,
            link_token: token,
            link_expires_at: expiresAt,
          })
          .eq("id", item.id);

        await setState(
          admin,
          item,
          emailed ? "link_sent" : skipReason ? "failed" : "not_started",
          emailed
            ? "apology_email_sent"
            : sendEmail
              ? "apology_email_skipped"
              : "link_created",
          actorId,
          {
            proposalId,
            link,
            skipReason,
            messageIds,
            alsoEmail,
            flaggedProposals: (item.proposal_ids ?? []).length,
          },
          note,
        );

        results.push({
          itemId: item.id,
          ok: !skipReason,
          state: emailed ? "link_sent" : skipReason ? "failed" : "not_started",
          link,
          skipReason,
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.error(`[agreement-recovery-action] ${item.id}: ${message}`);
        await setState(
          admin,
          item,
          "failed",
          `${action}_failed`,
          actorId,
          {
            error: message,
          },
          note,
        );
        results.push({ itemId: item.id, ok: false, error: message });
      }
    }

    return json({ success: true, results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    console.error("[agreement-recovery-action] Error:", message);
    return json({ error: message }, 500);
  }
});

async function nominateProposal(
  admin: ReturnType<typeof createClient>,
  item: RecoveryItem,
): Promise<string | null> {
  const ids = item.proposal_ids ?? [];
  if (!ids.length) return null;
  const { data } = await admin
    .from("proposals")
    .select("id")
    .in("id", ids)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

async function setState(
  admin: ReturnType<typeof createClient>,
  item: RecoveryItem,
  state: string,
  actionLabel: string,
  actorId: string | null,
  detail: Record<string, unknown>,
  note: string | null,
) {
  await admin
    .from("agreement_recovery_items")
    .update({
      state,
      last_action: actionLabel,
      last_action_by: actorId,
      last_action_at: new Date().toISOString(),
      ...(note ? { note } : {}),
    })
    .eq("id", item.id);

  await admin.from("agreement_recovery_events").insert({
    item_id: item.id,
    action: actionLabel,
    detail,
    actor: actorId,
  });
}

function buildApologyEmail(name: string, projectCount: number, link: string) {
  const projects =
    projectCount > 1
      ? `all ${projectCount} of your projects with us`
      : "your project with us";
  return renderBrandEmail({
    preheader: "Your Cession Agreement needs to be signed again — one click.",
    heading: `Dear ${name},`,
    bodyHtml: `
      <p style="margin:0 0 14px 0">We picked up a system fault on our side: your Cession Agreement was not recorded correctly when you signed, so we do not have a valid copy on file.</p>
      <p style="margin:0 0 14px 0">We're sorry for the inconvenience. Signing again takes under a minute, and one signature covers ${projects}.</p>
    `,
    ctaLabel: "Sign Cession Agreement",
    ctaHref: link,
    footerNote:
      "Nothing else about your project changes and no action is needed beyond this. This link is valid for 60 days.",
    signOff: "The Crunch Carbon Team",
  });
}

function buildApologyText(name: string, projectCount: number, link: string) {
  const projects =
    projectCount > 1
      ? `all ${projectCount} of your projects with us`
      : "your project with us";
  return [
    `Dear ${name},`,
    "",
    "We picked up a system fault on our side: your Cession Agreement was not recorded correctly when you signed, so we do not have a valid copy on file.",
    "",
    `We're sorry for the inconvenience. Signing again takes under a minute, and one signature covers ${projects}.`,
    "",
    `Sign Cession Agreement: ${link}`,
    "",
    "Nothing else about your project changes and no action is needed beyond this.",
    "",
    "Warm regards,",
    "The Crunch Carbon Team",
  ].join("\n");
}
