ALTER TABLE public.project_onboarding ADD COLUMN IF NOT EXISTS audit_tags text[] NOT NULL DEFAULT '{}'
  CHECK (audit_tags <@ ARRAY['Audit 1','Audit 2','Audit 3']::text[]);
UPDATE public.project_onboarding SET audit_tags = ARRAY[audit_tag] WHERE audit_tag IS NOT NULL;
DROP TRIGGER IF EXISTS trg_enforce_audit_tag_readiness ON public.project_onboarding;
DROP FUNCTION IF EXISTS public.set_project_audit_tag(uuid, text);
ALTER TABLE public.project_onboarding DROP COLUMN IF EXISTS audit_tag;
CREATE INDEX IF NOT EXISTS idx_project_onboarding_audit_tags ON public.project_onboarding USING gin (audit_tags);

CREATE OR REPLACE FUNCTION public.enforce_audit_tag_readiness()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.audit_ready IS DISTINCT FROM true THEN
    IF TG_OP = 'UPDATE' AND OLD.audit_ready = true THEN
      NEW.audit_tags := array_remove(NEW.audit_tags, 'Audit 3');
    END IF;
    IF TG_OP = 'INSERT' AND cardinality(NEW.audit_tags) > 0 THEN
      RAISE EXCEPTION 'Only Audit Ready projects can be added to an audit';
    ELSIF TG_OP = 'UPDATE' AND NOT (NEW.audit_tags <@ OLD.audit_tags) THEN
      RAISE EXCEPTION 'Only Audit Ready projects can be added to an audit';
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.enforce_audit_tag_readiness() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_enforce_audit_tag_readiness BEFORE INSERT OR UPDATE OF audit_tags, audit_ready
ON public.project_onboarding FOR EACH ROW EXECUTE FUNCTION public.enforce_audit_tag_readiness();

CREATE OR REPLACE FUNCTION public.set_project_audit_tags(p_onboarding_id uuid, p_tags text[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Only admins can change audits'; END IF;
  UPDATE public.project_onboarding
     SET audit_tags = COALESCE((SELECT array_agg(DISTINCT t ORDER BY t) FROM unnest(p_tags) t), '{}')
   WHERE id = p_onboarding_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Project not found'; END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.set_project_audit_tags(uuid, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_project_audit_tags(uuid, text[]) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.carry_forward_audit(p_from text, p_to text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Only admins can change audits'; END IF;
  IF p_from NOT IN ('Audit 1','Audit 2','Audit 3') OR p_to NOT IN ('Audit 1','Audit 2','Audit 3') OR p_from = p_to THEN
    RAISE EXCEPTION 'Invalid audits';
  END IF;
  UPDATE public.project_onboarding
     SET audit_tags = (SELECT array_agg(DISTINCT t ORDER BY t) FROM unnest(audit_tags || p_to) t)
   WHERE p_from = ANY(audit_tags) AND NOT (p_to = ANY(audit_tags)) AND audit_ready = true;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
REVOKE EXECUTE ON FUNCTION public.carry_forward_audit(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.carry_forward_audit(text, text) TO authenticated, service_role;