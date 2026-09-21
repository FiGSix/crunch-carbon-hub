
WITH latest_agreement AS (
  SELECT DISTINCT ON (pa.proposal_id) pa.proposal_id, pa.pdf_path, pa.signature_image_url
  FROM public.proposal_agreements pa
  ORDER BY pa.proposal_id, pa.created_at DESC
), affected AS (
  SELECT p.id AS proposal_id, p.client_reference_id AS client_id,
    CASE
      WHEN la.proposal_id IS NULL THEN 'C'
      WHEN la.signature_image_url IS NOT NULL AND btrim(la.signature_image_url) <> '' THEN 'A'
      ELSE 'B'
    END AS grp
  FROM public.proposals p
  LEFT JOIN latest_agreement la ON la.proposal_id = p.id
  WHERE p.deleted_at IS NULL
    AND p.client_reference_id IS NOT NULL
    AND ((la.proposal_id IS NOT NULL AND la.pdf_path IS NULL)
         OR (la.proposal_id IS NULL AND p.status IN ('approved','signed')))
), grouped AS (
  SELECT client_id,
    count(*)::int AS project_count,
    count(*) FILTER (WHERE grp = 'A')::int AS a_count,
    count(*) FILTER (WHERE grp = 'B')::int AS b_count,
    count(*) FILTER (WHERE grp = 'C')::int AS c_count,
    array_agg(proposal_id) AS proposal_ids
  FROM affected GROUP BY client_id
)
INSERT INTO public.agreement_recovery_items (
  client_id, client_name, client_email, group_code,
  a_count, b_count, c_count, project_count, proposal_ids
)
SELECT g.client_id,
  btrim(coalesce(c.first_name,'') || ' ' || coalesce(c.last_name,'')),
  c.email,
  CASE WHEN g.c_count > 0 THEN 'C' WHEN g.b_count > 0 THEN 'B' ELSE 'A' END,
  g.a_count, g.b_count, g.c_count, g.project_count, g.proposal_ids
FROM grouped g
JOIN public.clients c ON c.id = g.client_id
ON CONFLICT (client_id) DO NOTHING;
