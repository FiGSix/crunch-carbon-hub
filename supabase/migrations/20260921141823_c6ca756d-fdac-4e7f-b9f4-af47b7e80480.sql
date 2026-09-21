CREATE OR REPLACE FUNCTION public.log_recovery_event_for_proposal(
  p_proposal_id uuid,
  p_action text,
  p_detail jsonb DEFAULT '{}'::jsonb,
  p_state text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _item_id uuid;
BEGIN
  SELECT i.id INTO _item_id
  FROM public.agreement_recovery_items i
  WHERE i.link_proposal_id = p_proposal_id
     OR p_proposal_id = ANY (i.proposal_ids)
  ORDER BY (i.link_proposal_id = p_proposal_id) DESC
  LIMIT 1;

  IF _item_id IS NULL THEN
    RETURN false;
  END IF;

  INSERT INTO public.agreement_recovery_events (item_id, action, detail, actor)
  VALUES (_item_id, p_action, COALESCE(p_detail, '{}'::jsonb), NULL);

  IF p_state IS NOT NULL THEN
    UPDATE public.agreement_recovery_items
    SET state = p_state,
        last_action = p_action,
        last_action_at = now()
    WHERE id = _item_id
      AND resolved_at IS NULL
      AND state NOT IN ('signed', 'resolved', 'handled');
  END IF;

  RETURN true;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.log_recovery_event_for_proposal(uuid, text, jsonb, text) TO service_role;

CREATE OR REPLACE FUNCTION public.get_proposal_by_token_direct(token_param text)
 RETURNS TABLE(id uuid, title text, status text, content jsonb, agent_id uuid, client_id uuid, client_reference_id uuid, signed_at timestamp with time zone, created_at timestamp with time zone, archived_at timestamp with time zone, review_later_until timestamp with time zone, is_preview boolean, preview_of_id uuid, client_email text, invitation_token text, invitation_expires_at timestamp with time zone, annual_energy numeric, carbon_credits numeric, client_share_percentage numeric, system_size_kwp numeric, agent_commission_percentage numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _client_email TEXT;
  _token_valid BOOLEAN;
  _client_id UUID;
  _client_reference_id UUID;
  _proposal_id UUID;
  _already_viewed TIMESTAMPTZ;
BEGIN
  SELECT
    EXISTS(
      SELECT 1
      FROM proposals p
      WHERE p.invitation_token = token_param AND p.invitation_expires_at > now()
    ) INTO _token_valid;

  IF NOT _token_valid THEN
    RAISE EXCEPTION 'Invalid or expired invitation token';
  END IF;

  SELECT p.id, p.client_id, p.client_reference_id, p.invitation_viewed_at
  INTO _proposal_id, _client_id, _client_reference_id, _already_viewed
  FROM proposals p
  WHERE p.invitation_token = token_param;

  -- Record that the link was actually opened (first open only for the stamp,
  -- every open for the recovery audit trail).
  IF _already_viewed IS NULL THEN
    UPDATE proposals
    SET invitation_viewed_at = now()
    WHERE id = _proposal_id;

    PERFORM public.log_recovery_event_for_proposal(
      _proposal_id,
      'signing_link_opened',
      jsonb_build_object('proposal_id', _proposal_id, 'opened_at', now()),
      'opened'
    );
  END IF;

  SELECT
    COALESCE(
      (p.content->'clientInfo'->>'email'),
      (p.content->'client_information'->>'email'),
      (SELECT pr.email FROM public.profiles pr WHERE pr.id = _client_id),
      (SELECT c.email FROM public.clients c WHERE c.id = _client_reference_id)
    ) INTO _client_email
  FROM proposals p
  WHERE p.invitation_token = token_param;

  RETURN QUERY
  SELECT
    p.id, p.title, p.status,
    CASE
      WHEN p.content ? 'clientInfo' THEN p.content
      ELSE jsonb_build_object(
        'clientInfo', COALESCE(p.content->'client_information', '{}'::jsonb),
        'projectInfo', COALESCE(p.content->'project_information', '{}'::jsonb),
        'financialInfo', COALESCE(p.content->'financial_information', '{}'::jsonb)
      )
    END as content,
    p.agent_id, p.client_id,
    p.client_reference_id, p.signed_at, p.created_at, p.archived_at,
    p.review_later_until,
    NULL::boolean as is_preview,
    NULL::uuid as preview_of_id,
    _client_email as client_email,
    p.invitation_token,
    p.invitation_expires_at,
    p.annual_energy, p.carbon_credits, p.client_share_percentage,
    p.system_size_kwp,
    p.agent_commission_percentage
  FROM proposals p
  WHERE p.invitation_token = token_param AND p.invitation_expires_at > now();
END;
$function$;