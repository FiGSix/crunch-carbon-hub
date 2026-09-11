CREATE OR REPLACE FUNCTION public.is_client_email_suppressed(p_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.client_email_suppressions
    WHERE lower(email) = lower(p_email)
      AND reason IN ('manual', 'complaint', 'unsubscribe', 'invalid')
  )
  OR EXISTS (
    SELECT 1
    FROM public.email_events
    WHERE lower(recipient_email) = lower(p_email)
      AND (
        event_type IN ('email.complained', 'complained')
        OR (
          event_type IN ('email.bounced', 'bounced')
          AND coalesce(raw_payload #>> '{data,bounce,type}', 'Permanent') <> 'Transient'
        )
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_client_email_suppressed(text) TO anon, authenticated, service_role;

WITH incorrect_cc_bounces AS (
  SELECT DISTINCT e.proposal_id
  FROM public.email_events e
  JOIN public.proposal_automation_log l
    ON l.email_message_id = e.message_id
   AND l.proposal_id = e.proposal_id
  JOIN public.proposals p ON p.id = e.proposal_id
  WHERE e.event_type IN ('email.bounced', 'bounced')
    AND p.status = 'bounced'
    AND nullif(lower(trim(l.details ->> 'recipient')), '') IS NOT NULL
    AND lower(trim(e.recipient_email)) <> lower(trim(l.details ->> 'recipient'))
    AND NOT EXISTS (
      SELECT 1
      FROM public.email_events primary_bounce
      WHERE primary_bounce.proposal_id = e.proposal_id
        AND primary_bounce.event_type IN ('email.bounced', 'bounced')
        AND lower(trim(primary_bounce.recipient_email)) = lower(trim(l.details ->> 'recipient'))
    )
), repaired AS (
  UPDATE public.proposals p
  SET status = 'sent',
      last_email_event_type = 'email.sent',
      updated_at = now()
  FROM incorrect_cc_bounces b
  WHERE p.id = b.proposal_id
    AND p.status = 'bounced'
    AND p.signed_at IS NULL
    AND p.deleted_at IS NULL
  RETURNING p.id
)
INSERT INTO public.proposal_automation_log (
  proposal_id,
  automation_type,
  trigger_event,
  old_status,
  new_status,
  details
)
SELECT
  id,
  'status_update',
  'repair_misattributed_cc_bounce',
  'bounced',
  'sent',
  jsonb_build_object('reason', 'Bounce recipient differed from the stored primary client recipient')
FROM repaired;