-- 1. Widen master-agreement propagation to cover backlog projects in onboarding,
--    preserving each project's own original signing date.
CREATE OR REPLACE FUNCTION public.propagate_master_agreement()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_client_id uuid;
  v_email_norm text;
  v_company_id uuid;
  v_matched_clients uuid[];
BEGIN
  IF NEW.metadata IS NOT NULL
     AND (NEW.metadata->>'source') = 'master_agreement_propagation' THEN
    RETURN NEW;
  END IF;

  SELECT p.client_reference_id INTO v_client_id
  FROM public.proposals p
  WHERE p.id = NEW.proposal_id;

  IF v_client_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT lower(btrim(c.email)), c.client_company_id
    INTO v_email_norm, v_company_id
  FROM public.clients c
  WHERE c.id = v_client_id;

  SELECT array_agg(DISTINCT c.id)
    INTO v_matched_clients
  FROM public.clients c
  WHERE c.id = v_client_id
     OR (v_company_id IS NOT NULL AND c.client_company_id = v_company_id)
     OR (v_email_norm IS NOT NULL AND v_email_norm <> ''
         AND lower(btrim(c.email)) = v_email_norm);

  IF v_matched_clients IS NULL OR array_length(v_matched_clients, 1) = 0 THEN
    v_matched_clients := ARRAY[v_client_id];
  END IF;

  UPDATE public.clients
     SET cession_signed_at = NEW.signed_at,
         first_agreement_id = NEW.id
   WHERE id = ANY(v_matched_clients)
     AND cession_signed_at IS NULL;

  INSERT INTO public.proposal_agreements (
    proposal_id, signed_by, signed_at, signature_type, signature_type_used,
    typed_name, signature_image_url, accepted_terms_version,
    client_cession_signature_id, legal_document_id, legal_document_version,
    ip_address, user_agent,
    witness_1_name, witness_1_verified_at, witness_1_ip_address,
    witness_2_name, witness_2_verified_at, witness_2_ip_address,
    witness_method, metadata
  )
  SELECT
    p.id, NEW.signed_by,
    COALESCE(p.signed_at, NEW.signed_at),
    NEW.signature_type, NEW.signature_type_used,
    NEW.typed_name, NEW.signature_image_url, NEW.accepted_terms_version,
    NEW.client_cession_signature_id, NEW.legal_document_id, NEW.legal_document_version,
    NEW.ip_address, NEW.user_agent,
    NEW.witness_1_name, COALESCE(p.signed_at, NEW.signed_at), NEW.witness_1_ip_address,
    NEW.witness_2_name, COALESCE(p.signed_at, NEW.signed_at), NEW.witness_2_ip_address,
    NEW.witness_method,
    jsonb_build_object(
      'source', 'master_agreement_propagation',
      'origin_agreement_id', NEW.id,
      'origin_proposal_id', NEW.proposal_id,
      'signatory_name', COALESCE(NEW.metadata->>'signatory_name', NEW.typed_name),
      'signatory_email', NEW.metadata->>'signatory_email',
      'signer_user_id', NEW.metadata->>'signer_user_id',
      'actual_signature_captured_at', NEW.signed_at,
      'backdated', (p.signed_at IS NOT NULL AND p.signed_at < NEW.signed_at)
    )
  FROM public.proposals p
  WHERE p.client_reference_id = ANY(v_matched_clients)
    AND p.id <> NEW.proposal_id
    AND p.deleted_at IS NULL
    AND p.archived_at IS NULL
    AND (
      p.status IN ('draft','sent','delivered','opened','viewed','stale')
      OR (
        p.status IN ('approved','signed')
        AND EXISTS (SELECT 1 FROM public.project_onboarding po WHERE po.proposal_id = p.id)
      )
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.proposal_agreements pa
      WHERE pa.proposal_id = p.id
        AND pa.superseded_at IS NULL
    );

  UPDATE public.proposals
     SET status = 'approved',
         signed_at = COALESCE(signed_at, NEW.signed_at)
   WHERE client_reference_id = ANY(v_matched_clients)
     AND id <> NEW.proposal_id
     AND status IN ('draft','sent','delivered','opened','viewed','stale')
     AND deleted_at IS NULL
     AND archived_at IS NULL;

  RETURN NEW;
END;
$function$;

-- 2. Progress tracking on the recovery list
ALTER TABLE public.agreement_recovery_items
  ADD COLUMN IF NOT EXISTS total_count integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.refresh_agreement_recovery()
 RETURNS TABLE(total_clients integer, a_total integer, b_total integer, c_total integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total integer;
  v_a integer;
  v_b integer;
  v_c integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only administrators can refresh the agreement recovery list';
  END IF;

  CREATE TEMP TABLE _affected ON COMMIT DROP AS
  WITH latest_agreement AS (
    SELECT DISTINCT ON (pa.proposal_id)
      pa.proposal_id, pa.pdf_path, pa.signature_image_url
    FROM public.proposal_agreements pa
    WHERE pa.superseded_at IS NULL
    ORDER BY pa.proposal_id, pa.created_at DESC
  ),
  rows AS (
    SELECT
      p.id AS proposal_id,
      p.client_reference_id AS client_id,
      CASE
        WHEN la.proposal_id IS NULL THEN 'C'
        WHEN la.signature_image_url IS NOT NULL AND btrim(la.signature_image_url) <> '' THEN 'A'
        ELSE 'B'
      END AS grp
    FROM public.proposals p
    LEFT JOIN latest_agreement la ON la.proposal_id = p.id
    WHERE p.deleted_at IS NULL
      AND p.client_reference_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM public.project_onboarding po WHERE po.proposal_id = p.id)
      AND (
        (la.proposal_id IS NOT NULL AND la.pdf_path IS NULL)
        OR (la.proposal_id IS NULL AND p.status IN ('approved','signed'))
      )
  )
  SELECT * FROM rows;

  WITH grouped AS (
    SELECT
      a.client_id,
      count(*)::int AS project_count,
      count(*) FILTER (WHERE a.grp = 'A')::int AS a_count,
      count(*) FILTER (WHERE a.grp = 'B')::int AS b_count,
      count(*) FILTER (WHERE a.grp = 'C')::int AS c_count,
      array_agg(a.proposal_id) AS proposal_ids
    FROM _affected a
    GROUP BY a.client_id
  )
  INSERT INTO public.agreement_recovery_items AS t (
    client_id, client_name, client_email, group_code,
    a_count, b_count, c_count, project_count, total_count, proposal_ids
  )
  SELECT
    g.client_id,
    btrim(coalesce(c.first_name,'') || ' ' || coalesce(c.last_name,'')),
    c.email,
    CASE WHEN g.c_count > 0 THEN 'C' WHEN g.b_count > 0 THEN 'B' ELSE 'A' END,
    g.a_count, g.b_count, g.c_count, g.project_count, g.project_count, g.proposal_ids
  FROM grouped g
  JOIN public.clients c ON c.id = g.client_id
  ON CONFLICT (client_id) DO UPDATE SET
    client_name = EXCLUDED.client_name,
    client_email = EXCLUDED.client_email,
    group_code = EXCLUDED.group_code,
    a_count = EXCLUDED.a_count,
    b_count = EXCLUDED.b_count,
    c_count = EXCLUDED.c_count,
    project_count = EXCLUDED.project_count,
    total_count = greatest(coalesce(t.total_count, 0), EXCLUDED.project_count),
    proposal_ids = EXCLUDED.proposal_ids,
    resolved_at = NULL,
    state = CASE WHEN t.state = 'resolved' THEN 'not_started' ELSE t.state END,
    updated_at = now();

  -- Anything no longer affected is complete.
  UPDATE public.agreement_recovery_items t
  SET state = 'resolved',
      resolved_at = coalesce(t.resolved_at, now()),
      a_count = 0, b_count = 0, c_count = 0, project_count = 0,
      updated_at = now()
  WHERE t.resolved_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM _affected a WHERE a.client_id = t.client_id);

  -- Clients who have since signed but still have projects to rebuild.
  UPDATE public.agreement_recovery_items t
  SET state = 'signed', updated_at = now()
  WHERE t.resolved_at IS NULL
    AND t.state IN ('not_started','link_sent','opened','failed','bounced')
    AND EXISTS (
      SELECT 1 FROM public.client_cession_signatures s
      WHERE s.client_id = t.client_id AND s.revoked_at IS NULL
    );

  SELECT count(*)::int,
         coalesce(sum(a_count),0)::int,
         coalesce(sum(b_count),0)::int,
         coalesce(sum(c_count),0)::int
    INTO v_total, v_a, v_b, v_c
  FROM public.agreement_recovery_items
  WHERE resolved_at IS NULL;

  RETURN QUERY SELECT v_total, v_a, v_b, v_c;
END;
$function$;