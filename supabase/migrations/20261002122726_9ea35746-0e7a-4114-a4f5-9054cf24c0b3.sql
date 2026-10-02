CREATE OR REPLACE FUNCTION public.sandbox_is_test(_table text, _id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _id IS NULL THEN RETURN false; END IF;
  RETURN CASE _table
    WHEN 'proposals' THEN EXISTS (SELECT 1 FROM proposals WHERE id = _id AND is_test)
    WHEN 'project_onboarding' THEN EXISTS (SELECT 1 FROM project_onboarding WHERE id = _id AND is_test)
    WHEN 'clients' THEN EXISTS (SELECT 1 FROM clients WHERE id = _id AND is_test)
    WHEN 'companies' THEN EXISTS (SELECT 1 FROM companies WHERE id = _id AND is_test)
    WHEN 'client_companies' THEN EXISTS (SELECT 1 FROM client_companies WHERE id = _id AND is_test)
    WHEN 'client_user' THEN EXISTS (SELECT 1 FROM clients WHERE user_id = _id AND is_test)
    ELSE false END;
END $$;
REVOKE EXECUTE ON FUNCTION public.sandbox_is_test(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sandbox_is_test(text, uuid) TO authenticated, service_role;

DO $$
DECLARE r record; parent text; col text; extra text; expr text;
BEGIN
  FOR r IN SELECT tablename, qual FROM pg_policies
           WHERE schemaname='public' AND policyname='Sandbox fence' AND tablename <> 'profiles'
             AND qual ~ 'FROM \w+ x'
  LOOP
    parent := substring(r.qual from 'FROM (\w+) x');
    col := substring(r.qual from 'x\.id = \w+\.(\w+)');
    extra := CASE WHEN r.qual LIKE '%(user_id = auth.uid())%' THEN ' OR user_id = auth.uid()' ELSE '' END;
    expr := format('(NOT (SELECT public.sandbox_current())) OR public.sandbox_is_test(%L, %I)', parent, col);
    EXECUTE format('DROP POLICY "Sandbox fence" ON public.%I', r.tablename);
    EXECUTE format('CREATE POLICY "Sandbox fence" ON public.%I AS RESTRICTIVE FOR ALL USING (%s%s) WITH CHECK (%s)',
                   r.tablename, expr, extra, expr);
  END LOOP;
END $$;

DROP POLICY "Sandbox fence" ON public.profiles;
CREATE POLICY "Sandbox fence" ON public.profiles AS RESTRICTIVE FOR ALL
  USING ((NOT (SELECT public.sandbox_current())) OR id = auth.uid() OR public.is_test_account(id) OR public.sandbox_is_test('client_user', id))
  WITH CHECK ((NOT (SELECT public.sandbox_current())) OR id = auth.uid());