DROP FUNCTION IF EXISTS public.delete_proposal(uuid, uuid);
DROP FUNCTION IF EXISTS public.archive_proposal(uuid, uuid);

CREATE FUNCTION public.delete_proposal(proposal_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _uid uuid := auth.uid();
  _is_admin boolean := public.has_role(auth.uid(), 'admin');
  _p record;
BEGIN
  IF _uid IS NULL THEN RETURN FALSE; END IF;
  SELECT id, agent_id, signed_at INTO _p FROM proposals WHERE id = delete_proposal.proposal_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  IF NOT _is_admin THEN
    IF _p.agent_id IS DISTINCT FROM _uid OR NOT public.has_role(_uid, 'agent') THEN RETURN FALSE; END IF;
    IF _p.signed_at IS NOT NULL OR EXISTS (SELECT 1 FROM project_onboarding po WHERE po.proposal_id = _p.id) THEN
      RAISE EXCEPTION 'Signed or onboarding proposals can only be deleted by an admin';
    END IF;
  END IF;

  UPDATE proposals SET deleted_at = now(), deleted_by = _uid WHERE id = _p.id;

  UPDATE clients SET first_agreement_id = NULL, cession_signed_at = NULL, updated_at = now()
  WHERE first_agreement_id = _p.id;

  UPDATE clients c SET first_agreement_id = NULL, cession_signed_at = NULL, updated_at = now()
  FROM proposal_clients pc
  WHERE pc.proposal_id = _p.id AND c.id = pc.client_id
    AND (c.first_agreement_id = _p.id OR c.first_agreement_id IS NULL)
    AND c.cession_signed_at IS NOT NULL;
  RETURN TRUE;
END; $$;

CREATE FUNCTION public.archive_proposal(proposal_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RETURN FALSE; END IF;
  UPDATE proposals SET archived_at = now(), archived_by = _uid
  WHERE id = archive_proposal.proposal_id
    AND (public.has_role(_uid, 'admin') OR (agent_id = _uid AND public.has_role(_uid, 'agent')));
  RETURN FOUND;
END; $$;

REVOKE ALL ON FUNCTION public.delete_proposal(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.archive_proposal(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_proposal(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.archive_proposal(uuid) TO authenticated, service_role;