CREATE OR REPLACE FUNCTION public.enforce_proposal_duplicate_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_client uuid := coalesce(NEW.client_reference_id, NEW.client_id);
  v_address text := coalesce(NEW.content->'projectInfo'->>'address', NEW.project_info->>'address');
  v_size numeric := coalesce(
    NEW.system_size_kwp,
    public.safe_numeric(NEW.content->'projectInfo'->>'systemSize'),
    public.safe_numeric(NEW.content->'projectInfo'->>'size'),
    public.safe_numeric(NEW.project_info->>'systemSize'),
    public.safe_numeric(NEW.project_info->>'size')
  );
  v_lat numeric := coalesce(
    public.safe_numeric(NEW.content->'projectInfo'->>'gpsLat'),
    public.safe_numeric(NEW.project_info->>'gpsLat')
  );
  v_lng numeric := coalesce(
    public.safe_numeric(NEW.content->'projectInfo'->>'gpsLng'),
    public.safe_numeric(NEW.project_info->>'gpsLng')
  );
  v_source text := coalesce(NEW.project_info->>'source', NEW.content->>'source');
  v_match record;
BEGIN
  -- Public self-service calculator estimates are not installer site claims:
  -- a person may estimate their own roof as often as they like.
  IF v_source = 'public_calculator' THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(concat_ws('|', v_client::text, public.normalize_project_identity(NEW.title), round(coalesce(v_size, 0), 1)::text), 0));
  SELECT * INTO v_match FROM public.find_high_confidence_proposal_duplicate(v_client, NEW.title, v_address, v_size, v_lat, v_lng, NULL);
  IF v_match.proposal_id IS NOT NULL AND (
    NEW.duplicate_review_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.proposal_duplicate_reviews r
      WHERE r.id = NEW.duplicate_review_id
        AND r.status = 'approved_separate'
        AND r.matched_proposal_id = v_match.proposal_id
        AND r.submitting_agent_id IS NOT DISTINCT FROM NEW.agent_id
    )
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'DUPLICATE_REVIEW_REQUIRED';
  END IF;
  RETURN NEW;
END
$function$;