DO $$
DECLARE
  r record;
  keep_anon text[] := ARRAY['get_proposal_by_token_direct','validate_token_direct','get_public_homeowner_stats','get_live_legal_document','mark_invitation_viewed','get_referral_partner_info','get_minimum_vintage_year','increment_proposal_engagement','log_recovery_event_for_proposal','has_accepted_latest_version'];
  app_used text[] := ARRAY['admin_link_person_to_company','admin_unlink_person_from_company','apply_sp_default_to_recruits','backfill_super_partner_commissions','decide_proposal_duplicate_review','delete_proposal','ensure_agent_has_company','find_or_create_client_by_email','generate_secure_token','get_agent_clients_count','get_agent_clients_paginated','get_agent_clients_paginated_admin','get_agents_management_counts','get_agents_management_data','get_client_company_member_profiles','get_company_member_profiles','get_dashboard_metrics_by_stage','get_data_access_status','get_partner_network_counts','get_pending_team_invitations','get_super_partner_commission_by_company','get_super_partner_companies','get_super_partner_dashboard_stats','get_super_partner_rate','is_client_email_suppressed','queue_proposal_duplicate_review','recalc_super_partner_rates','refresh_agreement_recovery','request_company_link','resolve_client_company','search_clients','set_legal_document_live','upgrade_agent_to_super_partner','validate_onboarding_completion','can_send_client_email','check_proposal_duplicates','find_or_create_client_for_partner_api','get_agent_by_email','get_partner_attribution','get_primary_role','get_user_role','has_role','is_current_user_admin','resolve_broadcast_audience','update_partner_api_key_usage','update_proposal_status_with_log','validate_partner_api_key'];
  sig text; used_elsewhere boolean;
BEGIN
  FOR r IN SELECT p.oid, p.proname, p.prorettype='trigger'::regtype AS trg
           FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
           WHERE n.nspname='public' AND p.prosecdef LOOP
    sig := r.oid::regprocedure::text;
    used_elsewhere :=
      EXISTS (SELECT 1 FROM pg_policies pp WHERE coalesce(pp.qual,'')||coalesce(pp.with_check,'') ~ ('\m'||r.proname||'\M'))
      OR EXISTS (SELECT 1 FROM pg_views v WHERE v.schemaname='public' AND v.definition ~ ('\m'||r.proname||'\M'))
      OR EXISTS (SELECT 1 FROM pg_proc q JOIN pg_namespace n2 ON n2.oid=q.pronamespace WHERE n2.nspname='public' AND NOT q.prosecdef AND q.oid<>r.oid AND q.prosrc ~ ('\m'||r.proname||'\M'));
    IF r.trg THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', sig);
    ELSIF r.proname = ANY(keep_anon) OR used_elsewhere THEN
      NULL; -- intentionally reachable (public signing/calculator flows or referenced by row rules/views)
    ELSIF r.proname = ANY(app_used) THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', sig);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', sig);
    ELSE
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', sig);
    END IF;
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', sig);
  END LOOP;

  FOR r IN SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
           WHERE n.nspname='public' AND p.prokind='f' AND p.proconfig IS NULL
             AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid=p.oid AND d.deptype='e') LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public', r.oid::regprocedure::text);
  END LOOP;
END $$;

ALTER VIEW public.proposal_engagement_buckets SET (security_invoker = true);
ALTER VIEW public.portfolio_reminder_candidates SET (security_invoker = true);

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;