CREATE OR REPLACE FUNCTION public.ensure_agent_has_company(p_agent_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_company_id uuid;
  v_profile public.profiles%ROWTYPE;
  v_base text;
  v_name text;
BEGIN
  IF p_agent_id IS NULL THEN RETURN NULL; END IF;

  SELECT company_id INTO v_company_id
    FROM public.company_members
   WHERE user_id = p_agent_id AND status = 'active'
   ORDER BY created_at ASC LIMIT 1;
  IF v_company_id IS NOT NULL THEN RETURN v_company_id; END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = p_agent_id;
  IF v_profile.id IS NULL THEN RAISE EXCEPTION 'Agent profile not found: %', p_agent_id; END IF;

  v_base := NULLIF(TRIM(COALESCE(v_profile.company_name, '')), '');
  IF v_base IS NULL THEN
    v_base := NULLIF(TRIM(CONCAT(COALESCE(v_profile.first_name,''),' ',COALESCE(v_profile.last_name,''))),'');
    v_base := COALESCE(v_base, v_profile.email);
  END IF;
  v_name := v_base || ' (Solo · ' || SUBSTRING(p_agent_id::text, 1, 8) || ')';

  -- Idempotent: a solo company for this user may already exist (e.g. the owner is a
  -- client, so no company_members row was ever created). Reuse it instead of failing
  -- on the unique company_name constraint.
  SELECT id INTO v_company_id FROM public.companies WHERE company_name = v_name;

  IF v_company_id IS NULL THEN
    INSERT INTO public.companies (company_name, created_by)
    VALUES (v_name, p_agent_id)
    ON CONFLICT (company_name) DO NOTHING
    RETURNING id INTO v_company_id;

    IF v_company_id IS NULL THEN
      SELECT id INTO v_company_id FROM public.companies WHERE company_name = v_name;
    END IF;
  END IF;

  IF v_profile.role <> 'client' AND NOT EXISTS (
    SELECT 1 FROM public.company_members
     WHERE company_id = v_company_id AND user_id = p_agent_id
  ) THEN
    INSERT INTO public.company_members
      (company_id, user_id, role, status, invited_by, approved_by, invited_at, approved_at)
    VALUES
      (v_company_id, p_agent_id, 'team_lead', 'active', p_agent_id, p_agent_id, now(), now());
  END IF;

  RETURN v_company_id;
END; $function$;