ALTER TABLE public.project_onboarding ADD COLUMN IF NOT EXISTS audit_tag text
  CHECK (audit_tag IS NULL OR audit_tag IN ('Audit 1','Audit 2','Audit 3'));

CREATE OR REPLACE FUNCTION public.enforce_audit_tag_readiness()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.audit_ready IS DISTINCT FROM true THEN
    IF TG_OP = 'UPDATE' AND OLD.audit_ready = true AND NEW.audit_tag IS NOT DISTINCT FROM OLD.audit_tag THEN
      NEW.audit_tag := NULL;
    ELSIF NEW.audit_tag IS NOT NULL THEN
      RAISE EXCEPTION 'Only Audit Ready projects can be tagged with an audit';
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.enforce_audit_tag_readiness() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_enforce_audit_tag_readiness ON public.project_onboarding;
CREATE TRIGGER trg_enforce_audit_tag_readiness BEFORE INSERT OR UPDATE OF audit_tag, audit_ready
ON public.project_onboarding FOR EACH ROW EXECUTE FUNCTION public.enforce_audit_tag_readiness();

CREATE OR REPLACE FUNCTION public.set_project_audit_tag(p_onboarding_id uuid, p_audit_tag text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can tag projects with an audit';
  END IF;
  UPDATE public.project_onboarding SET audit_tag = NULLIF(p_audit_tag, '') WHERE id = p_onboarding_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Project not found'; END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.set_project_audit_tag(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_project_audit_tag(uuid, text) TO authenticated, service_role;