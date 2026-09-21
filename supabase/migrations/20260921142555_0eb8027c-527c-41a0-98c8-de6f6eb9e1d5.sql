UPDATE public.proposals p
SET resign_required = true,
    resign_requested_at = COALESCE(p.resign_requested_at, now())
FROM public.agreement_recovery_items i
WHERE i.resolved_at IS NULL
  AND i.link_token IS NOT NULL
  AND p.id = ANY (i.proposal_ids)
  AND COALESCE(p.resign_required, false) = false
  AND p.deleted_at IS NULL;