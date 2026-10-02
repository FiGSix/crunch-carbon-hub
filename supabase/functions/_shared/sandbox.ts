// Test sandbox guard for edge functions.
//
// 1. Importing this module installs a mail guard: every request to Resend's
//    /emails endpoints is inspected. If any recipient belongs to a test
//    account or a test client, or the payload carries the SANDBOX_HEADER flag,
//    all recipients are replaced by the tester's inbox and the subject is
//    prefixed with "[TEST]". Real people never receive sandbox email.
// 2. Helpers let functions refuse test accounts outright (real-data tools)
//    or limit them to test proposals.
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

export const SANDBOX_HEADER = "X-Crunch-Sandbox";
const RESEND_EMAILS = "https://api.resend.com/emails";

let guardAdmin: SupabaseClient | null = null;
function admin(): SupabaseClient {
  if (!guardAdmin) {
    guardAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return guardAdmin;
}

type Payload = Record<string, unknown> & {
  to?: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject?: string;
  headers?: Record<string, string>;
};

const list = (v: unknown): string[] =>
  v == null ? [] : (Array.isArray(v) ? v : [v]).map((x) => String(x));

// "Name <a@b.com>" -> "a@b.com"
const bare = (s: string) => (s.match(/<([^>]+)>/)?.[1] ?? s).trim().toLowerCase();

async function rewrite(p: Payload): Promise<Payload | null> {
  const flagged = !!p.headers && Object.keys(p.headers).some((k) => k.toLowerCase() === SANDBOX_HEADER.toLowerCase());
  const recipients = [...list(p.to), ...list(p.cc), ...list(p.bcc)].map(bare);

  let inbox: string | null = null;
  if (flagged) {
    const { data } = await admin().rpc("sandbox_default_inbox");
    inbox = (data as string | null) ?? null;
    if (!inbox) return null; // flagged but nowhere safe to send: drop it
  } else if (recipients.length) {
    const { data, error } = await admin().rpc("sandbox_mail_inbox", { _emails: recipients });
    if (error) console.error("[sandbox] recipient check failed", error.message);
    inbox = (data as string | null) ?? null;
  }
  if (!inbox) return p; // real email, untouched

  const headers = { ...(p.headers ?? {}) };
  for (const k of Object.keys(headers)) if (k.toLowerCase() === SANDBOX_HEADER.toLowerCase()) delete headers[k];
  const subject = String(p.subject ?? "");
  const out: Payload = {
    ...p,
    to: [inbox],
    subject: `[TEST] ${subject.replace(/^\[TEST\]\s*/, "")} (meant for: ${recipients.join(", ")})`.slice(0, 900),
    headers,
  };
  delete out.cc;
  delete out.bcc;
  delete out.reply_to;
  console.log("[sandbox] email redirected to test inbox", { originalRecipients: recipients.length });
  return out;
}

function installMailGuard() {
  const g = globalThis as unknown as { __crunchSandboxGuard?: boolean };
  if (g.__crunchSandboxGuard) return;
  g.__crunchSandboxGuard = true;
  const realFetch = globalThis.fetch.bind(globalThis);

  globalThis.fetch = async (input: Request | URL | string, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (!url.startsWith(RESEND_EMAILS) || !init?.body || typeof init.body !== "string") {
      return realFetch(input, init);
    }
    try {
      const body = JSON.parse(init.body);
      const isBatch = Array.isArray(body);
      const items: Payload[] = isBatch ? body : [body];
      const rewritten = (await Promise.all(items.map(rewrite))).filter((x): x is Payload => x !== null);
      if (!rewritten.length) {
        return new Response(JSON.stringify(isBatch ? { data: [] } : { id: "sandbox-dropped" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return realFetch(input, { ...init, body: JSON.stringify(isBatch ? rewritten : rewritten[0]) });
    } catch (e) {
      console.error("[sandbox] mail guard error, email not sent", e);
      return new Response(JSON.stringify({ name: "sandbox_guard_error", message: "Email blocked by sandbox guard" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  };
}
installMailGuard();

// ---------------------------------------------------------------- helpers

export async function isTestAccount(client: SupabaseClient, userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  const { data } = await client.rpc("is_test_account", { _uid: userId });
  return data === true;
}

/** Flag an outgoing email payload as sandbox mail when the caller is a test account. */
export function sandboxFlag<T extends Record<string, unknown>>(payload: T, isTest: boolean): T {
  if (!isTest) return payload;
  const headers = { ...((payload as { headers?: Record<string, string> }).headers ?? {}), [SANDBOX_HEADER]: "1" };
  return { ...payload, headers };
}

export const SANDBOX_REFUSED = "Not available for test accounts: this action works on real data.";

/** Response for functions that test accounts may never use. */
export function sandboxRefusal(cors: Record<string, string>): Response {
  return new Response(JSON.stringify({ success: false, error: SANDBOX_REFUSED }), {
    status: 403,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

/** True when a test account targets any proposal that is not test data. */
export async function touchesRealProposals(
  client: SupabaseClient,
  userId: string | null | undefined,
  proposalIds: (string | null | undefined)[],
): Promise<boolean> {
  if (!(await isTestAccount(client, userId))) return false;
  const ids = [...new Set(proposalIds.filter((x): x is string => !!x))];
  if (!ids.length) return false;
  const { data } = await client.from("proposals").select("id").in("id", ids).eq("is_test", true);
  return (data?.length ?? 0) !== ids.length;
}
