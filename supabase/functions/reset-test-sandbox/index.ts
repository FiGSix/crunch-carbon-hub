// Nightly sandbox reset: removes every test-stamped record, its files, and any
// sign-in accounts that only exist because of test data, then re-seeds the demo
// fixtures. Only rows with is_test = true are ever touched.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const pathIn = (value: string | null | undefined, bucket: string): string | null => {
  if (!value) return null;
  const marker = `/${bucket}/`;
  const i = value.indexOf(marker);
  const p = i >= 0 ? value.slice(i + marker.length) : value;
  return p.startsWith("http") ? null : p.split("?")[0];
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Callers: service role, the scheduled job (shared cron secret), or a real admin.
  const cronSecret = Deno.env.get("SWEEP_CRON_SECRET") ?? "";
  const bearer = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
  let allowed = bearer === serviceKey || (cronSecret !== "" && bearer === cronSecret);
  if (!allowed && bearer) {
    const { data: { user } } = await admin.auth.getUser(bearer);
    if (user) {
      const [{ data: isAdmin }, { data: isTest }] = await Promise.all([
        admin.rpc("has_role", { _user_id: user.id, _role: "admin" }),
        admin.rpc("is_test_account", { _uid: user.id }),
      ]);
      allowed = isAdmin === true && isTest !== true;
    }
  }
  if (!allowed) return json({ error: "Unauthorized" }, 401);

  try {
    // ---- collect what to clean up before the rows disappear
    const { data: testProposals } = await admin.from("proposals").select("id, pdf_url").eq("is_test", true);
    const proposalIds = (testProposals ?? []).map((p) => p.id);
    const { data: testProjects } = await admin.from("project_onboarding").select("id").eq("is_test", true);
    const { data: testClients } = await admin.from("clients").select("id, user_id").eq("is_test", true);
    const { data: testAccounts } = await admin.from("test_accounts").select("user_id, created_at");
    const testUserIds = new Set((testAccounts ?? []).map((t) => t.user_id));
    const sandboxSince = (testAccounts ?? []).map((t) => t.created_at).sort()[0];

    const agreementPaths: string[] = [];
    if (proposalIds.length) {
      const { data: agreements } = await admin
        .from("proposal_agreements")
        .select("pdf_path, signature_image_url")
        .in("proposal_id", proposalIds);
      for (const a of agreements ?? []) {
        for (const v of [a.pdf_path, a.signature_image_url]) {
          const p = pathIn(v, "signed-agreements");
          if (p) agreementPaths.push(p);
        }
      }
    }
    const clientIds = (testClients ?? []).map((c) => c.id);
    if (clientIds.length) {
      const { data: sigs } = await admin
        .from("client_cession_signatures")
        .select("signature_image_url, legal_document_file_path")
        .in("client_id", clientIds);
      for (const s of sigs ?? []) {
        for (const v of [s.signature_image_url, s.legal_document_file_path]) {
          const p = pathIn(v, "signed-agreements");
          if (p) agreementPaths.push(p);
        }
      }
    }
    const proposalPdfPaths = (testProposals ?? [])
      .map((p) => pathIn(p.pdf_url, "proposal-pdfs"))
      .filter((p): p is string => !!p);

    // Sign-in accounts created only by test flows (never test accounts, never pre-existing users).
    const candidateUsers = [...new Set((testClients ?? []).map((c) => c.user_id).filter((u): u is string => !!u && !testUserIds.has(u)))];
    const usersToDelete: string[] = [];
    for (const uid of candidateUsers) {
      const [{ count: realClients }, { count: realProposals }, { data: prof }] = await Promise.all([
        admin.from("clients").select("id", { count: "exact", head: true }).eq("user_id", uid).eq("is_test", false),
        admin.from("proposals").select("id", { count: "exact", head: true }).eq("is_test", false).or(`agent_id.eq.${uid},client_id.eq.${uid}`),
        admin.from("profiles").select("created_at").eq("id", uid).maybeSingle(),
      ]);
      const createdInSandbox = !prof || (sandboxSince && prof.created_at >= sandboxSince);
      if (!realClients && !realProposals && createdInSandbox) usersToDelete.push(uid);
    }

    // ---- database reset (test rows only) + re-seed
    const { data: summary, error: resetError } = await admin.rpc("reset_test_sandbox");
    if (resetError) throw resetError;

    // ---- files
    const removed: Record<string, number> = {};
    const remove = async (bucket: string, paths: string[]) => {
      const unique = [...new Set(paths)];
      for (let i = 0; i < unique.length; i += 100) {
        const { data } = await admin.storage.from(bucket).remove(unique.slice(i, i + 100));
        removed[bucket] = (removed[bucket] ?? 0) + (data?.length ?? 0);
      }
    };
    await remove("signed-agreements", agreementPaths);
    await remove("proposal-pdfs", proposalPdfPaths);
    for (const proj of testProjects ?? []) {
      const folder = proj.id;
      const { data: top } = await admin.storage.from("onboarding-documents").list(folder, { limit: 1000 });
      const paths: string[] = [];
      for (const entry of top ?? []) {
        if (entry.id) paths.push(`${folder}/${entry.name}`);
        else {
          const { data: inner } = await admin.storage.from("onboarding-documents").list(`${folder}/${entry.name}`, { limit: 1000 });
          for (const f of inner ?? []) paths.push(`${folder}/${entry.name}/${f.name}`);
        }
      }
      await remove("onboarding-documents", paths);
    }

    // ---- accounts that only existed for test data
    let usersDeleted = 0;
    for (const uid of usersToDelete) {
      await admin.from("user_roles").delete().eq("user_id", uid);
      await admin.from("client_company_members").delete().eq("user_id", uid);
      await admin.from("notifications").delete().eq("user_id", uid);
      await admin.from("profiles").delete().eq("id", uid);
      const { error } = await admin.auth.admin.deleteUser(uid);
      if (error) console.error("[reset-test-sandbox] could not delete user", uid, error.message);
      else usersDeleted++;
    }

    const result = { ...(summary as Record<string, number>), files_removed: removed, users_deleted: usersDeleted };
    await admin.from("sandbox_reset_log").insert({ summary: result });
    console.log("[reset-test-sandbox] done", result);
    return json({ success: true, result });
  } catch (e) {
    console.error("[reset-test-sandbox] failed", e);
    return json({ success: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
