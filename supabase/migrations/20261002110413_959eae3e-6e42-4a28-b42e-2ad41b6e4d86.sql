-- Which inbox (if any) an outgoing email must be redirected to: returns the
-- test inbox when any recipient belongs to a test account or test client.
CREATE OR REPLACE FUNCTION public.sandbox_mail_inbox(_emails text[])
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH r AS (SELECT DISTINCT lower(btrim(e)) e FROM unnest(_emails) e WHERE e IS NOT NULL)
  SELECT (SELECT inbox_email FROM test_accounts ORDER BY created_at LIMIT 1)
  WHERE EXISTS (SELECT 1 FROM r JOIN clients c ON lower(c.email) = r.e WHERE c.is_test)
     OR EXISTS (SELECT 1 FROM r JOIN test_accounts t ON lower(t.inbox_email) = r.e)
     OR EXISTS (SELECT 1 FROM r JOIN profiles p ON lower(p.email) = r.e JOIN test_accounts t ON t.user_id = p.id)
$$;
CREATE OR REPLACE FUNCTION public.sandbox_default_inbox()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT inbox_email FROM test_accounts ORDER BY created_at LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.sandbox_mail_inbox(text[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sandbox_default_inbox() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sandbox_mail_inbox(text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.sandbox_default_inbox() TO service_role;