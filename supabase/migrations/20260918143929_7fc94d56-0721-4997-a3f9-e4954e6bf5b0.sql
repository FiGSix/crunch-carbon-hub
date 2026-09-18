-- =====================================================================
-- Consolidate the two overlapping SELECT policies on public.proposals
-- into a single policy, with a per-user equivalence proof that aborts
-- the migration on any difference.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Snapshot: visibility under the CURRENT rules
--    (union of proposals_select_policy and proposals_select_unified,
--     both permissive, so a row is visible if either matches)
-- ---------------------------------------------------------------------
CREATE TEMP TABLE _vis_old ON COMMIT DROP AS
SELECT u.id AS uid, p.id AS pid
FROM auth.users u
JOIN public.proposals p
  ON p.deleted_at IS NULL
 AND (
      -- own projects
      p.agent_id = u.id
      -- team mates (company_members)
      OR EXISTS (
           SELECT 1
           FROM public.company_members cm1
           JOIN public.company_members cm2 ON cm1.company_id = cm2.company_id
           WHERE cm1.user_id = u.id
             AND cm2.user_id = p.agent_id
             AND cm1.status = 'active'
             AND cm2.status = 'active')
      -- client account on the proposal
      OR p.client_id = u.id
      -- proposals_select_unified: is_proposal_client(client_reference_id)
      OR EXISTS (
           SELECT 1 FROM public.clients c
           WHERE c.id = p.client_reference_id AND c.user_id = u.id)
      -- proposals_select_policy: client_reference_id = ANY(get_user_client_ids())
      OR EXISTS (
           SELECT 1 FROM public.clients c
           WHERE c.id = p.client_reference_id AND c.user_id = u.id)
      -- proposals_select_policy: client_reference_id = ANY(get_user_client_company_client_ids())
      OR EXISTS (
           SELECT 1
           FROM public.clients c
           JOIN public.client_company_members ccm
             ON ccm.client_company_id = c.client_company_id
           WHERE c.id = p.client_reference_id
             AND ccm.user_id = u.id
             AND ccm.status = 'active')
      -- admins
      OR public.has_role(u.id, 'admin')
 );

-- ---------------------------------------------------------------------
-- 2. Projection: visibility under the PROPOSED single rule
--    (transcribed from the new policy expression created in step 4)
-- ---------------------------------------------------------------------
CREATE TEMP TABLE _vis_new ON COMMIT DROP AS
SELECT u.id AS uid, p.id AS pid
FROM auth.users u
JOIN public.proposals p
  ON p.deleted_at IS NULL
 AND (
      p.agent_id = u.id
      OR EXISTS (
           SELECT 1
           FROM public.company_members cm1
           JOIN public.company_members cm2 ON cm1.company_id = cm2.company_id
           WHERE cm1.user_id = u.id
             AND cm2.user_id = p.agent_id
             AND cm1.status = 'active'
             AND cm2.status = 'active')
      OR p.client_id = u.id
      OR EXISTS (
           SELECT 1 FROM public.clients c
           WHERE c.id = p.client_reference_id AND c.user_id = u.id)
      OR EXISTS (
           SELECT 1
           FROM public.clients c
           JOIN public.client_company_members ccm
             ON ccm.client_company_id = c.client_company_id
           WHERE c.id = p.client_reference_id
             AND ccm.user_id = u.id
             AND ccm.status = 'active')
      OR public.has_role(u.id, 'admin')
 );

-- ---------------------------------------------------------------------
-- 3. Equivalence assertion over EVERY user account
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_diff bigint;
  v_users bigint;
  v_rows bigint;
BEGIN
  SELECT count(*) INTO v_diff
  FROM (
    (SELECT uid, pid FROM _vis_old EXCEPT SELECT uid, pid FROM _vis_new)
    UNION ALL
    (SELECT uid, pid FROM _vis_new EXCEPT SELECT uid, pid FROM _vis_old)
  ) d;

  IF v_diff <> 0 THEN
    RAISE EXCEPTION
      'Visibility equivalence check FAILED: % (user, project) differences. No changes applied.', v_diff;
  END IF;

  SELECT count(DISTINCT uid), count(*) INTO v_users, v_rows FROM _vis_old;
  RAISE NOTICE 'Visibility equivalence verified: % user accounts, % visible (user, project) pairs, 0 differences.', v_users, v_rows;
END $$;

-- ---------------------------------------------------------------------
-- 4. Apply: one consolidated policy replacing the two overlapping ones.
--    Scoped TO public so anonymous invitation-token access is preserved
--    exactly as proposals_select_policy provided it.
--    auth.uid() and the helper functions are wrapped in scalar
--    subqueries so Postgres evaluates them once per query (initplan)
--    instead of once per row.
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "proposals_select_policy" ON public.proposals;
DROP POLICY IF EXISTS "proposals_select_unified" ON public.proposals;

CREATE POLICY "proposals_select_unified"
ON public.proposals
FOR SELECT
TO public
USING (
  deleted_at IS NULL
  AND (
    agent_id = (SELECT auth.uid())
    OR client_id = (SELECT auth.uid())
    OR client_reference_id = ANY ((SELECT public.get_user_client_ids())::uuid[])
    OR client_reference_id = ANY ((SELECT public.get_user_client_company_client_ids())::uuid[])
    OR (SELECT public.is_current_user_admin())
    OR EXISTS (
         SELECT 1
         FROM public.company_members cm1
         JOIN public.company_members cm2 ON cm1.company_id = cm2.company_id
         WHERE cm1.user_id = (SELECT auth.uid())
           AND cm2.user_id = proposals.agent_id
           AND cm1.status = 'active'
           AND cm2.status = 'active')
    OR (
         invitation_token IS NOT NULL
         AND invitation_expires_at > now()
         AND current_setting('request.invitation_token', true) = invitation_token)
  )
);