
-- Invitations: remove catch-all updates (acceptance runs server-side)
DROP POLICY IF EXISTS "System can update invitations" ON public.agent_invitations;
CREATE POLICY "Admins or sender can update agent invitations" ON public.agent_invitations FOR UPDATE TO authenticated
  USING (is_current_user_admin() OR invited_by = auth.uid()) WITH CHECK (is_current_user_admin() OR invited_by = auth.uid());

DROP POLICY IF EXISTS "System can update client invitations" ON public.client_invitations;
CREATE POLICY "Admins or sender can update client invitations" ON public.client_invitations FOR UPDATE TO authenticated
  USING (is_current_user_admin() OR invited_by = auth.uid()) WITH CHECK (is_current_user_admin() OR invited_by = auth.uid());

DROP POLICY IF EXISTS "System can update client team invitations" ON public.client_team_invitations;
CREATE POLICY "Account admins can update client team invitations" ON public.client_team_invitations FOR UPDATE TO authenticated
  USING (is_client_account_admin(auth.uid(), client_company_id) OR is_current_user_admin())
  WITH CHECK (is_client_account_admin(auth.uid(), client_company_id) OR is_current_user_admin());

DROP POLICY IF EXISTS "System can update invitation acceptance" ON public.team_invitations;

DROP POLICY IF EXISTS "System can insert partner invitations" ON public.partner_invitations;
DROP POLICY IF EXISTS "System can update partner invitations" ON public.partner_invitations;
CREATE POLICY "Admins can insert partner invitations" ON public.partner_invitations FOR INSERT TO authenticated
  WITH CHECK (is_current_user_admin());
CREATE POLICY "Admins can update partner invitations" ON public.partner_invitations FOR UPDATE TO authenticated
  USING (is_current_user_admin()) WITH CHECK (is_current_user_admin());

-- Referrals: recorded server-side
DROP POLICY IF EXISTS "System can insert referrals" ON public.client_referrals;
DROP POLICY IF EXISTS "System can update referrals" ON public.client_referrals;
CREATE POLICY "Admins can manage referrals insert" ON public.client_referrals FOR INSERT TO authenticated
  WITH CHECK (is_current_user_admin() OR referrer_id = auth.uid());

-- Companies
DROP POLICY IF EXISTS "System can insert companies" ON public.companies;
CREATE POLICY "Users create own companies" ON public.companies FOR INSERT TO authenticated
  WITH CHECK (is_current_user_admin() OR created_by = auth.uid());
DROP POLICY IF EXISTS "System can insert client companies" ON public.client_companies;
CREATE POLICY "Users create own client companies" ON public.client_companies FOR INSERT TO authenticated
  WITH CHECK (is_current_user_admin() OR created_by = auth.uid());

-- Notifications
DROP POLICY IF EXISTS "notifications_system_insert" ON public.notifications;
CREATE POLICY "Signed-in users can create notifications" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = user_id));

-- Onboarding
DROP POLICY IF EXISTS "System can insert onboarding" ON public.project_onboarding;
CREATE POLICY "Admins can insert onboarding" ON public.project_onboarding FOR INSERT TO authenticated
  WITH CHECK (is_current_user_admin());

DROP POLICY IF EXISTS "System can insert activity" ON public.onboarding_activity_log;
CREATE POLICY "Stakeholders log own activity" ON public.onboarding_activity_log FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid() AND (is_current_user_admin() OR is_project_stakeholder(project_id)));

DROP POLICY IF EXISTS "System can insert automation logs" ON public.proposal_automation_log;
CREATE POLICY "Users log own automation entries" ON public.proposal_automation_log FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() OR is_current_user_admin());

-- Audit / partner system: server-side only
DROP POLICY IF EXISTS "System can insert audit logs" ON public.user_role_audit;
DROP POLICY IF EXISTS "System can insert API logs" ON public.partner_api_logs;
DROP POLICY IF EXISTS "System can insert webhook deliveries" ON public.partner_webhook_deliveries;
DROP POLICY IF EXISTS "System can update webhook deliveries" ON public.partner_webhook_deliveries;

-- Contact form: public but validated
DROP POLICY IF EXISTS "Anyone can submit contact form" ON public.contact_submissions;
CREATE POLICY "Anyone can submit valid contact form" ON public.contact_submissions FOR INSERT TO anon, authenticated
  WITH CHECK (
    length(trim(coalesce(name,''))) BETWEEN 1 AND 200
    AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' AND length(email) <= 320
    AND length(coalesce(subject,'')) <= 300
    AND length(trim(coalesce(question,''))) BETWEEN 1 AND 5000
    AND length(coalesce(phone,'')) <= 50
    AND length(coalesce(company,'')) <= 200
  );

-- Vintage audit: admin only (admin manage policies already exist)
DROP POLICY IF EXISTS "Users can view vintage audit status" ON public.vintage_audit_status;
DROP POLICY IF EXISTS "Users can view vintage progress notes" ON public.vintage_progress_notes;
