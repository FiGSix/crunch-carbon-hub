CREATE OR REPLACE FUNCTION public.safe_numeric(_v text)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN _v IS NULL THEN NULL
    WHEN btrim(_v) ~ '^-?[0-9]+(\.[0-9]+)?' THEN (substring(btrim(_v) from '^-?[0-9]+(\.[0-9]+)?'))::numeric
    ELSE NULL
  END
$$;

CREATE OR REPLACE FUNCTION public.find_high_confidence_proposal_duplicate(
  p_client_id uuid,
  p_title text,
  p_address text,
  p_system_size_kwp numeric,
  p_latitude numeric DEFAULT NULL,
  p_longitude numeric DEFAULT NULL,
  p_exclude_proposal_id uuid DEFAULT NULL
)
RETURNS TABLE(proposal_id uuid, match_score integer, match_reasons text[])
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH candidate AS (
    SELECT
      p.id,
      public.normalize_project_identity(p.title) = public.normalize_project_identity(p_title)
        AND public.normalize_project_identity(p_title) <> '' AS same_title,
      public.normalize_project_identity(coalesce(p.content->'projectInfo'->>'address', p.project_info->>'address'))
        = public.normalize_project_identity(p_address)
        AND public.normalize_project_identity(p_address) <> '' AS same_address,
      CASE
        WHEN p_system_size_kwp IS NULL THEN false
        ELSE abs(coalesce(
          p.system_size_kwp,
          public.safe_numeric(p.content->'projectInfo'->>'systemSize'),
          public.safe_numeric(p.content->'projectInfo'->>'size'),
          public.safe_numeric(p.project_info->>'systemSize'),
          public.safe_numeric(p.project_info->>'size')
        ) - p_system_size_kwp) <= greatest(0.5, p_system_size_kwp * 0.005)
      END AS same_size,
      CASE
        WHEN p_latitude IS NULL OR p_longitude IS NULL THEN false
        WHEN coalesce(
          public.safe_numeric(p.content->'projectInfo'->>'gpsLat'),
          public.safe_numeric(p.project_info->>'gpsLat')
        ) IS NULL THEN false
        ELSE 6371000 * 2 * asin(sqrt(
          power(sin(radians((coalesce(
            public.safe_numeric(p.content->'projectInfo'->>'gpsLat'),
            public.safe_numeric(p.project_info->>'gpsLat')
          ) - p_latitude) / 2)), 2)
          + cos(radians(p_latitude))
          * cos(radians(coalesce(
            public.safe_numeric(p.content->'projectInfo'->>'gpsLat'),
            public.safe_numeric(p.project_info->>'gpsLat')
          )))
          * power(sin(radians((coalesce(
            public.safe_numeric(p.content->'projectInfo'->>'gpsLng'),
            public.safe_numeric(p.project_info->>'gpsLng')
          ) - p_longitude) / 2)), 2)
        )) <= 500
      END AS nearby,
      coalesce(p.client_reference_id, p.client_id) = p_client_id AS same_client
    FROM public.proposals p
    WHERE p.archived_at IS NULL
      AND p.deleted_at IS NULL
      AND (p_exclude_proposal_id IS NULL OR p.id <> p_exclude_proposal_id)
  ), scored AS (
    SELECT
      id,
      ((same_client::int * 35) + (same_title::int * 30) + (same_size::int * 25)
        + (same_address::int * 20) + (nearby::int * 10)) AS score,
      array_remove(ARRAY[
        CASE WHEN same_client THEN 'same_client' END,
        CASE WHEN same_title THEN 'same_project_name' END,
        CASE WHEN same_size THEN 'same_system_size' END,
        CASE WHEN same_address THEN 'same_address' END,
        CASE WHEN nearby THEN 'nearby_location' END
      ], NULL) AS reasons
    FROM candidate
    WHERE (same_client AND same_title AND same_size)
      OR (same_client AND same_address AND same_size)
      OR (same_title AND same_address AND same_size)
      OR (same_client AND same_title AND nearby)
  )
  SELECT id, score, reasons
  FROM scored
  ORDER BY score DESC, id
  LIMIT 1
$function$;

CREATE OR REPLACE FUNCTION public.enforce_proposal_duplicate_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
  v_match record;
BEGIN
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