
-- Widen master cession propagation: cover drafts, cover every client record of
-- the same client company, and carry the signer identity into inherited rows.
CREATE OR REPLACE FUNCTION public.propagate_master_agreement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    p.id, NEW.signed_by, NEW.signed_at, NEW.signature_type, NEW.signature_type_used,
    NEW.typed_name, NEW.signature_image_url, NEW.accepted_terms_version,
    NEW.client_cession_signature_id, NEW.legal_document_id, NEW.legal_document_version,
    NEW.ip_address, NEW.user_agent,
    NEW.witness_1_name, NEW.witness_1_verified_at, NEW.witness_1_ip_address,
    NEW.witness_2_name, NEW.witness_2_verified_at, NEW.witness_2_ip_address,
    NEW.witness_method,
    jsonb_build_object(
      'source', 'master_agreement_propagation',
      'origin_agreement_id', NEW.id,
      'origin_proposal_id', NEW.proposal_id,
      'signatory_name', COALESCE(NEW.metadata->>'signatory_name', NEW.typed_name),
      'signatory_email', NEW.metadata->>'signatory_email',
      'signer_user_id', NEW.metadata->>'signer_user_id'
    )
  FROM public.proposals p
  WHERE p.client_reference_id = ANY(v_matched_clients)
    AND p.id <> NEW.proposal_id
    AND p.status IN ('draft','sent','delivered','opened','viewed','stale')
    AND p.deleted_at IS NULL
    AND p.archived_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.proposal_agreements pa WHERE pa.proposal_id = p.id
    );

  UPDATE public.proposals
     SET status = 'approved',
         signed_at = NEW.signed_at
   WHERE client_reference_id = ANY(v_matched_clients)
     AND id <> NEW.proposal_id
     AND status IN ('draft','sent','delivered','opened','viewed','stale')
     AND deleted_at IS NULL
     AND archived_at IS NULL;

  RETURN NEW;
END;
$$;

-- New projects for a company that already signed inherit that signature at once.
CREATE OR REPLACE FUNCTION public.inherit_master_agreement_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
  v_email_norm text;
  v_master public.client_cession_signatures%ROWTYPE;
BEGIN
  IF NEW.client_reference_id IS NULL OR NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT c.client_company_id, lower(btrim(c.email))
    INTO v_company_id, v_email_norm
  FROM public.clients c
  WHERE c.id = NEW.client_reference_id;

  SELECT s.* INTO v_master
  FROM public.client_cession_signatures s
  JOIN public.proposals op ON op.id = s.origin_proposal_id
  JOIN public.clients oc ON oc.id = op.client_reference_id
  WHERE oc.id = NEW.client_reference_id
     OR (v_company_id IS NOT NULL AND oc.client_company_id = v_company_id)
     OR (v_email_norm IS NOT NULL AND v_email_norm <> ''
         AND lower(btrim(oc.email)) = v_email_norm)
  ORDER BY s.signed_at DESC NULLS LAST
  LIMIT 1;

  IF v_master.id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.proposal_agreements (
    proposal_id, signed_by, signed_at, signature_type, signature_type_used,
    typed_name, signature_image_url, accepted_terms_version,
    client_cession_signature_id, legal_document_id, legal_document_version,
    ip_address, user_agent,
    witness_1_name, witness_1_verified_at, witness_1_ip_address,
    witness_2_name, witness_2_verified_at, witness_2_ip_address,
    witness_method, metadata
  )
  VALUES (
    NEW.id, v_master.signed_by, v_master.signed_at, v_master.signature_type, v_master.signature_type,
    v_master.typed_name, v_master.signature_image_url, v_master.accepted_terms_version,
    v_master.id, v_master.legal_document_id, v_master.legal_document_version,
    v_master.ip_address, v_master.user_agent,
    'DIGITAL WITNESS 1', v_master.signed_at, v_master.ip_address,
    'DIGITAL WITNESS 2', v_master.signed_at, v_master.ip_address,
    'automatic_system',
    jsonb_build_object(
      'source', 'master_agreement_propagation',
      'origin_agreement_id', v_master.id,
      'origin_proposal_id', v_master.origin_proposal_id,
      'signatory_name', COALESCE(v_master.metadata->>'signatory_name', v_master.typed_name),
      'signatory_email', v_master.metadata->>'signatory_email',
      'signer_user_id', v_master.metadata->>'signer_user_id'
    )
  )
  ON CONFLICT DO NOTHING;

  UPDATE public.proposals
     SET status = 'approved',
         signed_at = v_master.signed_at
   WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inherit_master_agreement_on_insert ON public.proposals;
CREATE TRIGGER trg_inherit_master_agreement_on_insert
AFTER INSERT ON public.proposals
FOR EACH ROW
EXECUTE FUNCTION public.inherit_master_agreement_on_insert();
