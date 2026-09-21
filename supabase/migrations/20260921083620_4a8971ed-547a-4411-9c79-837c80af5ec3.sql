
CREATE TABLE public.agreement_recovery_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL UNIQUE REFERENCES public.clients(id) ON DELETE CASCADE,
  client_name text,
  client_email text,
  group_code text NOT NULL CHECK (group_code IN ('A','B','C')),
  a_count integer NOT NULL DEFAULT 0,
  b_count integer NOT NULL DEFAULT 0,
  c_count integer NOT NULL DEFAULT 0,
  project_count integer NOT NULL DEFAULT 0,
  proposal_ids uuid[] NOT NULL DEFAULT '{}',
  state text NOT NULL DEFAULT 'not_started'
    CHECK (state IN ('not_started','fixed','link_sent','opened','signed','bounced','failed','handled','resolved')),
  link_proposal_id uuid,
  link_token text,
  link_expires_at timestamptz,
  last_action text,
  last_action_by uuid,
  last_action_at timestamptz,
  note text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.agreement_recovery_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.agreement_recovery_items(id) ON DELETE CASCADE,
  action text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_agreement_recovery_events_item ON public.agreement_recovery_events(item_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agreement_recovery_items TO authenticated;
GRANT ALL ON public.agreement_recovery_items TO service_role;
GRANT SELECT, INSERT ON public.agreement_recovery_events TO authenticated;
GRANT ALL ON public.agreement_recovery_events TO service_role;

ALTER TABLE public.agreement_recovery_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agreement_recovery_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage agreement recovery items"
  ON public.agreement_recovery_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins manage agreement recovery events"
  ON public.agreement_recovery_events FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER update_agreement_recovery_items_updated_at
  BEFORE UPDATE ON public.agreement_recovery_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Rebuilds the recovery list from live records. Preserves state, notes and links.
CREATE OR REPLACE FUNCTION public.refresh_agreement_recovery()
RETURNS TABLE (total_clients integer, a_total integer, b_total integer, c_total integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    a_count, b_count, c_count, project_count, proposal_ids
  )
  SELECT
    g.client_id,
    btrim(coalesce(c.first_name,'') || ' ' || coalesce(c.last_name,'')),
    c.email,
    CASE WHEN g.c_count > 0 THEN 'C' WHEN g.b_count > 0 THEN 'B' ELSE 'A' END,
    g.a_count, g.b_count, g.c_count, g.project_count, g.proposal_ids
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

  SELECT count(*)::int,
         coalesce(sum(a_count),0)::int,
         coalesce(sum(b_count),0)::int,
         coalesce(sum(c_count),0)::int
    INTO v_total, v_a, v_b, v_c
  FROM public.agreement_recovery_items
  WHERE resolved_at IS NULL;

  RETURN QUERY SELECT v_total, v_a, v_b, v_c;
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_agreement_recovery() TO authenticated;

-- Hourly safety net: finish any signed project whose document was never produced.
DO $cron$
DECLARE
  v_headers text;
BEGIN
  SELECT (regexp_match(command, '(\{"Content-Type".*?\})''::jsonb'))[1]
    INTO v_headers
  FROM cron.job
  WHERE jobname = 'weekly-roundup-emails';

  IF v_headers IS NULL THEN
    RAISE NOTICE 'Could not derive service headers; hourly sweep not scheduled';
  ELSE
    PERFORM cron.unschedule('sweep-agreement-documents-hourly')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sweep-agreement-documents-hourly');

    PERFORM cron.schedule(
      'sweep-agreement-documents-hourly',
      '7 * * * *',
      format(
        'SELECT net.http_post(url:=%L, headers:=%L::jsonb, body:=%L::jsonb) as request_id;',
        'https://uyjryuopuqgmsvayiccl.supabase.co/functions/v1/sweep-agreement-documents',
        v_headers,
        '{"limit":25}'
      )
    );
  END IF;
END
$cron$;
