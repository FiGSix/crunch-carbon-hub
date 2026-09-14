
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
  WHERE s.revoked_at IS NULL
    AND (
      oc.id = NEW.client_reference_id
      OR (v_company_id IS NOT NULL AND oc.client_company_id = v_company_id)
      OR (v_email_norm IS NOT NULL AND v_email_norm <> ''
          AND lower(btrim(oc.email)) = v_email_norm)
    )
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
    NEW.id, v_master.signed_by, v_master.signed_at,
    v_master.signature_type::public.signature_type, v_master.signature_type::text,
    v_master.typed_name, v_master.signature_image_url, v_master.legal_document_version::text,
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

REVOKE EXECUTE ON FUNCTION public.inherit_master_agreement_on_insert() FROM anon, authenticated, PUBLIC;
