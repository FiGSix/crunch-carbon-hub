CREATE TABLE public.test_accounts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  inbox_email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.test_accounts TO authenticated;
GRANT ALL ON public.test_accounts TO service_role;
ALTER TABLE public.test_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Test accounts see their own row" ON public.test_accounts
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.sandbox_reset_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at timestamptz NOT NULL DEFAULT now(),
  summary jsonb NOT NULL DEFAULT '{}'::jsonb
);
GRANT SELECT ON public.sandbox_reset_log TO authenticated;
GRANT ALL ON public.sandbox_reset_log TO service_role;
ALTER TABLE public.sandbox_reset_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read sandbox reset log" ON public.sandbox_reset_log
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.is_test_account(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _uid IS NOT NULL AND EXISTS (SELECT 1 FROM public.test_accounts WHERE user_id = _uid)
$$;
CREATE OR REPLACE FUNCTION public.sandbox_current()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_test_account(auth.uid())
$$;
REVOKE ALL ON FUNCTION public.is_test_account(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sandbox_current() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_test_account(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sandbox_current() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.sandbox_block()
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.sandbox_current() THEN
    RAISE EXCEPTION 'Not available for test accounts: this action works on real data.';
  END IF;
END $$;
CREATE OR REPLACE FUNCTION public.sandbox_assert_proposal(_proposal_id uuid)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.sandbox_current() AND NOT EXISTS (SELECT 1 FROM proposals WHERE id = _proposal_id AND is_test) THEN
    RAISE EXCEPTION 'Test accounts can only change test data.';
  END IF;
END $$;
CREATE OR REPLACE FUNCTION public.sandbox_assert_onboarding(_project_id uuid)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.sandbox_current() AND NOT EXISTS (SELECT 1 FROM project_onboarding WHERE id = _project_id AND is_test) THEN
    RAISE EXCEPTION 'Test accounts can only change test data.';
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.sandbox_block() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sandbox_assert_proposal(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sandbox_assert_onboarding(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sandbox_block() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sandbox_assert_proposal(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sandbox_assert_onboarding(uuid) TO authenticated, service_role;

ALTER TABLE public.proposals          ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;
ALTER TABLE public.clients            ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;
ALTER TABLE public.client_companies   ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;
ALTER TABLE public.companies          ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;
ALTER TABLE public.project_onboarding ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS proposals_is_test_idx ON public.proposals (id) WHERE is_test;
CREATE INDEX IF NOT EXISTS clients_is_test_idx ON public.clients (id) WHERE is_test;
CREATE INDEX IF NOT EXISTS client_companies_is_test_idx ON public.client_companies (id) WHERE is_test;
CREATE INDEX IF NOT EXISTS companies_is_test_idx ON public.companies (id) WHERE is_test;
CREATE INDEX IF NOT EXISTS project_onboarding_is_test_idx ON public.project_onboarding (id) WHERE is_test;

CREATE OR REPLACE FUNCTION public.sandbox_stamp()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v boolean;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    v := OLD.is_test;
  ELSE
    v := coalesce(NEW.is_test, false) OR public.sandbox_current();
  END IF;

  IF TG_TABLE_NAME = 'proposals' THEN
    IF TG_OP = 'INSERT' THEN
      v := v OR public.is_test_account(NEW.agent_id) OR public.is_test_account(NEW.client_id)
             OR EXISTS (SELECT 1 FROM clients c WHERE c.id = NEW.client_reference_id AND c.is_test);
    END IF;
    IF NEW.client_reference_id IS NOT NULL
       AND EXISTS (SELECT 1 FROM clients c WHERE c.id = NEW.client_reference_id AND c.is_test <> v) THEN
      RAISE EXCEPTION 'Test data and real data cannot be mixed. Use a client email address that is only used for testing.';
    END IF;
  ELSIF TG_TABLE_NAME = 'project_onboarding' THEN
    IF TG_OP = 'INSERT' THEN
      SELECT p.is_test INTO v FROM proposals p WHERE p.id = NEW.proposal_id;
      v := coalesce(v, false);
    END IF;
  ELSIF TG_TABLE_NAME = 'clients' THEN
    IF TG_OP = 'INSERT' THEN
      v := v OR public.is_test_account(NEW.created_by) OR public.is_test_account(NEW.user_id);
    END IF;
  ELSE
    IF TG_OP = 'INSERT' THEN
      v := v OR public.is_test_account(NEW.created_by);
    END IF;
    IF TG_TABLE_NAME = 'client_companies' AND v THEN
      NEW.email_domain := NULL;
    END IF;
  END IF;

  NEW.is_test := v;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.sandbox_stamp() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER aa_sandbox_stamp BEFORE INSERT OR UPDATE ON public.proposals          FOR EACH ROW EXECUTE FUNCTION public.sandbox_stamp();
CREATE TRIGGER aa_sandbox_stamp BEFORE INSERT OR UPDATE ON public.clients            FOR EACH ROW EXECUTE FUNCTION public.sandbox_stamp();
CREATE TRIGGER aa_sandbox_stamp BEFORE INSERT OR UPDATE ON public.client_companies   FOR EACH ROW EXECUTE FUNCTION public.sandbox_stamp();
CREATE TRIGGER aa_sandbox_stamp BEFORE INSERT OR UPDATE ON public.companies          FOR EACH ROW EXECUTE FUNCTION public.sandbox_stamp();
CREATE TRIGGER aa_sandbox_stamp BEFORE INSERT OR UPDATE ON public.project_onboarding FOR EACH ROW EXECUTE FUNCTION public.sandbox_stamp();

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['proposals','clients','client_companies','companies','project_onboarding'] LOOP
    EXECUTE format('CREATE POLICY "Sandbox fence" ON public.%I AS RESTRICTIVE FOR ALL TO authenticated
      USING (is_test = (SELECT public.sandbox_current()))
      WITH CHECK (is_test = (SELECT public.sandbox_current()))', t);
  END LOOP;
END $$;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('proposal_agreements','proposal_id','proposals'),
    ('email_events','proposal_id','proposals'),
    ('proposal_automation_log','proposal_id','proposals'),
    ('proposal_clients','proposal_id','proposals'),
    ('super_partner_commissions','proposal_id','proposals'),
    ('agent_commissions','proposal_id','proposals'),
    ('onboarding_fields','project_id','project_onboarding'),
    ('onboarding_documents','project_id','project_onboarding'),
    ('data_access_config','project_id','project_onboarding'),
    ('onboarding_tasks','project_id','project_onboarding'),
    ('onboarding_activity_log','project_id','project_onboarding'),
    ('onboarding_comments','project_id','project_onboarding'),
    ('client_cession_signatures','client_id','clients'),
    ('client_team_invitations','client_company_id','client_companies'),
    ('team_invitations','company_id','companies'),
    ('agent_invitations','company_id','companies'),
    ('super_partner_link_requests','company_id','companies')
  ) v(tbl, col, parent) LOOP
    EXECUTE format('CREATE POLICY "Sandbox fence" ON public.%I AS RESTRICTIVE FOR ALL TO authenticated
      USING (NOT (SELECT public.sandbox_current()) OR EXISTS (SELECT 1 FROM public.%I x WHERE x.id = %I.%I AND x.is_test))
      WITH CHECK (NOT (SELECT public.sandbox_current()) OR EXISTS (SELECT 1 FROM public.%I x WHERE x.id = %I.%I AND x.is_test))',
      r.tbl, r.parent, r.tbl, r.col, r.parent, r.tbl, r.col);
  END LOOP;
END $$;

CREATE POLICY "Sandbox fence" ON public.company_members AS RESTRICTIVE FOR ALL TO authenticated
  USING (NOT (SELECT public.sandbox_current()) OR user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.companies x WHERE x.id = company_id AND x.is_test))
  WITH CHECK (NOT (SELECT public.sandbox_current()) OR EXISTS (SELECT 1 FROM public.companies x WHERE x.id = company_id AND x.is_test));
CREATE POLICY "Sandbox fence" ON public.client_company_members AS RESTRICTIVE FOR ALL TO authenticated
  USING (NOT (SELECT public.sandbox_current()) OR EXISTS (SELECT 1 FROM public.client_companies x WHERE x.id = client_company_id AND x.is_test))
  WITH CHECK (NOT (SELECT public.sandbox_current()) OR EXISTS (SELECT 1 FROM public.client_companies x WHERE x.id = client_company_id AND x.is_test));

CREATE POLICY "Sandbox fence" ON public.profiles AS RESTRICTIVE FOR ALL TO authenticated
  USING (NOT (SELECT public.sandbox_current()) OR id = auth.uid() OR public.is_test_account(id)
         OR EXISTS (SELECT 1 FROM public.clients c WHERE c.user_id = profiles.id AND c.is_test))
  WITH CHECK (NOT (SELECT public.sandbox_current()) OR id = auth.uid());

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('user_roles','user_id'), ('user_role_audit','user_id'), ('notifications','user_id'),
    ('legal_document_acceptances','user_id'), ('referral_events','user_id'), ('broadcast_recipients','user_id'),
    ('agent_activities','agent_id'), ('agent_weekly_snapshots','agent_id'), ('email_cta_events','agent_id')
  ) v(tbl, col) LOOP
    EXECUTE format('CREATE POLICY "Sandbox fence" ON public.%I AS RESTRICTIVE FOR ALL TO authenticated
      USING (NOT (SELECT public.sandbox_current()) OR %I = auth.uid())
      WITH CHECK (NOT (SELECT public.sandbox_current()) OR %I = auth.uid())', r.tbl, r.col, r.col);
  END LOOP;
END $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['agent_leads','agreement_recovery_events','agreement_recovery_items','broadcast_campaigns',
    'broadcast_excluded_addresses','candidate_notes','client_access_audit','client_email_suppressions','client_referrals',
    'contact_submissions','inbound_messages','meetings','partner_api_keys','partner_api_logs','partner_invitations',
    'partner_webhook_deliveries','partner_webhook_subscriptions','partners','proposal_duplicate_reviews'] LOOP
    EXECUTE format('CREATE POLICY "Sandbox fence" ON public.%I AS RESTRICTIVE FOR ALL TO authenticated
      USING (NOT (SELECT public.sandbox_current())) WITH CHECK (NOT (SELECT public.sandbox_current()))', t);
  END LOOP;
END $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['carbon_rate_sets','regional_solar_yields','inverter_portal_defaults','knowledge_hub_resources',
    'legal_documents','system_settings','vintage_audit_status','vintage_progress_notes','notification_state','solar_installers'] LOOP
    EXECUTE format('CREATE POLICY "Sandbox read only ins" ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (NOT (SELECT public.sandbox_current()))', t);
    EXECUTE format('CREATE POLICY "Sandbox read only upd" ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (NOT (SELECT public.sandbox_current()))', t);
    EXECUTE format('CREATE POLICY "Sandbox read only del" ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (NOT (SELECT public.sandbox_current()))', t);
  END LOOP;
END $$;

DO $$
DECLARE
  fn text; def text; patched text;
  block_list text[] := ARRAY['admin_link_person_to_company','admin_unlink_person_from_company','apply_sp_default_to_recruits',
    'backfill_super_partner_commissions','recalc_super_partner_rates','set_legal_document_live','merge_client_companies',
    'refresh_agreement_recovery','get_unsigned_cession_clients','resolve_broadcast_audience','get_agents_management_data',
    'get_agents_management_counts','upgrade_agent_to_super_partner'];
  p record;
BEGIN
  FOREACH fn IN ARRAY block_list LOOP
    FOR p IN SELECT oid FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = fn LOOP
      def := pg_get_functiondef(p.oid);
      patched := regexp_replace(def, E'\\nBEGIN[ \\t]*\\n', E'\nBEGIN\n  PERFORM public.sandbox_block();\n', 'i');
      IF patched = def THEN RAISE EXCEPTION 'Could not guard %', fn; END IF;
      EXECUTE patched;
    END LOOP;
  END LOOP;
END $$;

DO $$
DECLARE def text; patched text;
BEGIN
  def := pg_get_functiondef('public.delete_proposal(uuid)'::regprocedure);
  patched := regexp_replace(def, E'\\nBEGIN[ \\t]*\\n', E'\nBEGIN\n  PERFORM public.sandbox_assert_proposal(delete_proposal.proposal_id);\n', 'i');
  IF patched = def THEN RAISE EXCEPTION 'delete_proposal'; END IF; EXECUTE patched;

  def := pg_get_functiondef('public.archive_proposal(uuid)'::regprocedure);
  patched := regexp_replace(def, E'\\nBEGIN[ \\t]*\\n', E'\nBEGIN\n  PERFORM public.sandbox_assert_proposal(archive_proposal.proposal_id);\n', 'i');
  IF patched = def THEN RAISE EXCEPTION 'archive_proposal'; END IF; EXECUTE patched;

  def := pg_get_functiondef('public.set_project_audit_tags(uuid,text[])'::regprocedure);
  patched := regexp_replace(def, E'\\nBEGIN[ \\t]*\\n', E'\nBEGIN\n  PERFORM public.sandbox_assert_onboarding(p_onboarding_id);\n', 'i');
  IF patched = def THEN RAISE EXCEPTION 'set_project_audit_tags'; END IF; EXECUTE patched;

  def := pg_get_functiondef('public.carry_forward_audit(text,text)'::regprocedure);
  patched := replace(def, 'AND audit_ready = true;', 'AND audit_ready = true AND is_test = public.sandbox_current();');
  IF patched = def THEN RAISE EXCEPTION 'carry_forward_audit'; END IF; EXECUTE patched;

  def := pg_get_functiondef('public.get_dashboard_metrics_by_stage(uuid,text)'::regprocedure);
  patched := regexp_replace(def, 'WHERE p\.archived_at IS NULL', 'WHERE p.is_test = public.sandbox_current() AND p.archived_at IS NULL');
  IF patched = def THEN RAISE EXCEPTION 'get_dashboard_metrics_by_stage'; END IF; EXECUTE patched;

  def := pg_get_functiondef('public.get_agent_clients_paginated_admin(uuid,integer,integer,text)'::regprocedure);
  patched := replace(def, 'WHERE c.email IS NOT NULL', 'WHERE c.email IS NOT NULL AND c.is_test = public.sandbox_current()');
  IF patched = def THEN RAISE EXCEPTION 'get_agent_clients_paginated_admin'; END IF; EXECUTE patched;

  def := pg_get_functiondef('public.get_public_homeowner_stats()'::regprocedure);
  patched := regexp_replace(def, 'deleted_at IS NULL\)', 'deleted_at IS NULL AND NOT is_test)', 'g');
  IF patched = def THEN RAISE EXCEPTION 'get_public_homeowner_stats'; END IF; EXECUTE patched;

  def := pg_get_functiondef('public.refresh_agreement_recovery()'::regprocedure);
  patched := regexp_replace(def, 'WHERE p\.deleted_at IS NULL', 'WHERE p.deleted_at IS NULL AND NOT p.is_test');
  IF patched = def THEN RAISE EXCEPTION 'refresh_agreement_recovery'; END IF; EXECUTE patched;

  def := pg_get_functiondef('public.search_clients(text)'::regprocedure);
  patched := regexp_replace(def, 'FROM public\.clients c\s+WHERE \(', 'FROM public.clients c WHERE c.is_test = public.sandbox_current() AND (', 'g');
  patched := replace(patched, 'WHERE p.role = ''client''', 'WHERE p.role = ''client'' AND NOT public.sandbox_current()');
  IF patched = def THEN RAISE EXCEPTION 'search_clients'; END IF; EXECUTE patched;

  def := pg_get_functiondef('public.find_or_create_client_by_email(text,text,text,text,text,uuid)'::regprocedure);
  patched := regexp_replace(def, 'WHERE LOWER\(email\) = v_normalized_email', 'WHERE LOWER(email) = v_normalized_email AND is_test = (public.sandbox_current() OR public.is_test_account(p_created_by))', 'g');
  IF patched = def THEN RAISE EXCEPTION 'find_or_create_client_by_email'; END IF; EXECUTE patched;

  def := pg_get_functiondef('public.propagate_master_agreement()'::regprocedure);
  patched := regexp_replace(def, E'\\n  IF v_matched_clients IS NULL',
    E'\n  SELECT array_agg(c.id) INTO v_matched_clients FROM public.clients c\n   WHERE c.id = ANY(v_matched_clients)\n     AND c.is_test = (SELECT c0.is_test FROM public.clients c0 WHERE c0.id = v_client_id);\n\n  IF v_matched_clients IS NULL');
  IF patched = def THEN RAISE EXCEPTION 'propagate_master_agreement'; END IF; EXECUTE patched;

  def := pg_get_functiondef('public.inherit_master_agreement_on_insert()'::regprocedure);
  patched := replace(def, 'WHERE s.revoked_at IS NULL', 'WHERE s.revoked_at IS NULL AND oc.is_test = NEW.is_test');
  IF patched = def THEN RAISE EXCEPTION 'inherit_master_agreement_on_insert'; END IF; EXECUTE patched;
END $$;

-- Fixtures: the tester's own test client company + client record, and fake demo clients with draft proposals.
CREATE OR REPLACE FUNCTION public.sandbox_ensure_fixtures(_uid uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_email text; v_first text; v_last text; v_cc uuid; v_client uuid; v_demo uuid; i int;
  demo_names text[] := ARRAY['Demo Bakery','Demo Farms','Demo Logistics'];
BEGIN
  IF NOT public.is_test_account(_uid) THEN RETURN NULL; END IF;
  SELECT lower(email), first_name, last_name INTO v_email, v_first, v_last FROM profiles WHERE id = _uid;

  SELECT id INTO v_cc FROM client_companies WHERE created_by = _uid AND is_test ORDER BY created_at LIMIT 1;
  IF v_cc IS NULL THEN
    INSERT INTO client_companies (company_name, created_by, is_test)
    VALUES ('Sandbox Client Co (TEST)', _uid, true) RETURNING id INTO v_cc;
  END IF;

  SELECT id INTO v_client FROM clients WHERE user_id = _uid AND is_test LIMIT 1;
  IF v_client IS NULL AND NOT EXISTS (SELECT 1 FROM clients WHERE lower(email) = v_email) THEN
    INSERT INTO clients (email, first_name, last_name, company_name, user_id, created_by, client_company_id, is_test)
    VALUES (v_email, v_first, v_last, 'Sandbox Client Co (TEST)', _uid, _uid, v_cc, true);
  END IF;

  FOR i IN 1..array_length(demo_names, 1) LOOP
    IF NOT EXISTS (SELECT 1 FROM clients WHERE email = format('demo%s.%s@example.com', i, left(_uid::text, 8))) THEN
      INSERT INTO clients (email, first_name, last_name, company_name, created_by, is_test)
      VALUES (format('demo%s.%s@example.com', i, left(_uid::text, 8)), 'Demo', format('Client %s', i), demo_names[i] || ' (TEST)', _uid, true)
      RETURNING id INTO v_demo;
      INSERT INTO proposals (title, status, agent_id, client_reference_id, system_size_kwp, carbon_credits,
                             client_share_percentage, agent_commission_percentage, is_test, content)
      VALUES (demo_names[i] || ' rooftop (TEST)', 'draft', _uid, v_demo, 100 * i, 160 * i, 63, 0, true,
        jsonb_build_object(
          'clientInfo', jsonb_build_object('name', format('Demo Client %s', i), 'firstName', 'Demo', 'lastName', format('Client %s', i),
                                           'email', format('demo%s.%s@example.com', i, left(_uid::text, 8)), 'companyName', demo_names[i] || ' (TEST)'),
          'projectInfo', jsonb_build_object('name', demo_names[i] || ' rooftop (TEST)', 'size', (100 * i)::text,
                                            'address', format('%s Sandbox Street, Test Town', i), 'commissionDate', '2026-08-01',
                                            'isMultiPhase', false, 'generationInputMode', 'kwp')));
    END IF;
  END LOOP;
  RETURN v_cc;
END $$;

CREATE OR REPLACE FUNCTION public.sandbox_switch_role(p_role text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); v_cc uuid;
BEGIN
  IF NOT public.is_test_account(uid) THEN
    RAISE EXCEPTION 'Only test accounts can switch roles';
  END IF;
  IF p_role NOT IN ('client','agent','super_partner','admin') THEN
    RAISE EXCEPTION 'Unknown role %', p_role;
  END IF;
  v_cc := public.sandbox_ensure_fixtures(uid);

  DELETE FROM user_roles WHERE user_id = uid;
  INSERT INTO user_roles (user_id, role) VALUES (uid, p_role::app_role);
  DELETE FROM client_company_members WHERE user_id = uid;

  IF p_role = 'client' THEN
    -- Step through a neutral role so the client team row can be added before
    -- the client role lands (prevents auto-linking to a real company).
    UPDATE profiles SET role = 'super_partner', super_partner_status = NULL WHERE id = uid;
    INSERT INTO client_company_members (client_company_id, user_id, role, status, can_sign_agreements, invited_by)
    VALUES (v_cc, uid, 'account_admin', 'active', true, uid);
  END IF;

  UPDATE profiles
     SET role = p_role,
         super_partner_status = CASE WHEN p_role = 'super_partner' THEN 'active' ELSE NULL END,
         can_create_proposals = (p_role IN ('agent','super_partner','admin')),
         agent_status = 'active'
   WHERE id = uid;
  RETURN p_role;
END $$;

REVOKE ALL ON FUNCTION public.sandbox_switch_role(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sandbox_ensure_fixtures(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sandbox_switch_role(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sandbox_ensure_fixtures(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.reset_test_sandbox()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  n_prop int; n_cli int; n_cc int; n_co int; n_notif int; r record; result jsonb;
BEGIN
  DELETE FROM agent_commissions WHERE proposal_id IN (SELECT id FROM proposals WHERE is_test);
  DELETE FROM proposal_duplicate_reviews WHERE matched_proposal_id IN (SELECT id FROM proposals WHERE is_test);
  DELETE FROM proposals WHERE is_test;                    GET DIAGNOSTICS n_prop = ROW_COUNT;
  DELETE FROM project_onboarding WHERE is_test;
  DELETE FROM clients WHERE is_test;                      GET DIAGNOSTICS n_cli = ROW_COUNT;
  UPDATE clients SET client_company_id = NULL WHERE client_company_id IN (SELECT id FROM client_companies WHERE is_test);
  DELETE FROM client_company_members WHERE client_company_id IN (SELECT id FROM client_companies WHERE is_test)
    AND user_id NOT IN (SELECT user_id FROM test_accounts);
  DELETE FROM client_companies WHERE is_test
    AND id NOT IN (SELECT client_company_id FROM client_company_members);
  GET DIAGNOSTICS n_cc = ROW_COUNT;
  DELETE FROM agent_invitations WHERE company_id IN (SELECT id FROM companies WHERE is_test) OR target_company_id IN (SELECT id FROM companies WHERE is_test);
  DELETE FROM super_partner_link_requests WHERE company_id IN (SELECT id FROM companies WHERE is_test);
  DELETE FROM companies WHERE is_test;                    GET DIAGNOSTICS n_co = ROW_COUNT;
  DELETE FROM notifications WHERE user_id IN (SELECT user_id FROM test_accounts); GET DIAGNOSTICS n_notif = ROW_COUNT;

  FOR r IN SELECT user_id FROM test_accounts LOOP
    PERFORM public.sandbox_ensure_fixtures(r.user_id);
  END LOOP;

  result := jsonb_build_object('proposals', n_prop, 'clients', n_cli, 'client_companies', n_cc, 'companies', n_co, 'notifications', n_notif);
  INSERT INTO sandbox_reset_log (summary) VALUES (result);
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.reset_test_sandbox() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_test_sandbox() TO service_role;

INSERT INTO public.test_accounts (user_id, inbox_email)
VALUES ('87b766ee-9186-4857-bdf4-bbc7ab68a299', 'shaun@nuvoconsulting.com')
ON CONFLICT (user_id) DO NOTHING;
SELECT public.sandbox_ensure_fixtures('87b766ee-9186-4857-bdf4-bbc7ab68a299');
DELETE FROM public.user_roles WHERE user_id = '87b766ee-9186-4857-bdf4-bbc7ab68a299';
INSERT INTO public.user_roles (user_id, role) VALUES ('87b766ee-9186-4857-bdf4-bbc7ab68a299', 'admin');
UPDATE public.profiles SET role = 'admin', can_create_proposals = true, super_partner_status = NULL
 WHERE id = '87b766ee-9186-4857-bdf4-bbc7ab68a299';