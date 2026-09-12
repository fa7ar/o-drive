
-- 1) Lock down SECURITY DEFINER trigger functions so authenticated/anon users cannot execute them directly.
REVOKE EXECUTE ON FUNCTION public.provision_new_user() FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.bind_workspace_creator() FROM authenticated, anon, public;

-- 2) Log/audit tables: replace full ALL access with read + append-only for workspace members.
DROP POLICY IF EXISTS workspace_members_manage ON public.activity_logs;
CREATE POLICY activity_logs_member_select ON public.activity_logs
  FOR SELECT TO authenticated
  USING (workspace_id = public.current_workspace_id());
CREATE POLICY activity_logs_member_insert ON public.activity_logs
  FOR INSERT TO authenticated
  WITH CHECK (workspace_id = public.current_workspace_id());
REVOKE UPDATE, DELETE ON public.activity_logs FROM authenticated;

DROP POLICY IF EXISTS workspace_members_manage ON public.system_logs;
CREATE POLICY system_logs_member_select ON public.system_logs
  FOR SELECT TO authenticated
  USING (workspace_id = public.current_workspace_id());
CREATE POLICY system_logs_member_insert ON public.system_logs
  FOR INSERT TO authenticated
  WITH CHECK (workspace_id = public.current_workspace_id());
REVOKE UPDATE, DELETE ON public.system_logs FROM authenticated;

DROP POLICY IF EXISTS workspace_members_manage ON public.api_request_logs;
CREATE POLICY api_request_logs_member_select ON public.api_request_logs
  FOR SELECT TO authenticated
  USING (workspace_id = public.current_workspace_id());
CREATE POLICY api_request_logs_member_insert ON public.api_request_logs
  FOR INSERT TO authenticated
  WITH CHECK (workspace_id = public.current_workspace_id());
REVOKE UPDATE, DELETE ON public.api_request_logs FROM authenticated;

DROP POLICY IF EXISTS workspace_members_manage ON public.job_logs;
CREATE POLICY job_logs_member_select ON public.job_logs
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id = job_logs.job_id AND j.workspace_id = public.current_workspace_id()
  ));
CREATE POLICY job_logs_member_insert ON public.job_logs
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id = job_logs.job_id AND j.workspace_id = public.current_workspace_id()
  ));
REVOKE UPDATE, DELETE ON public.job_logs FROM authenticated;

DROP POLICY IF EXISTS workspace_members_manage ON public.share_access_logs;
CREATE POLICY share_access_logs_member_select ON public.share_access_logs
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.shares s
    WHERE s.id = share_access_logs.share_id AND s.workspace_id = public.current_workspace_id()
  ));
CREATE POLICY share_access_logs_member_insert ON public.share_access_logs
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.shares s
    WHERE s.id = share_access_logs.share_id AND s.workspace_id = public.current_workspace_id()
  ));
REVOKE UPDATE, DELETE ON public.share_access_logs FROM authenticated;

-- 3) Profiles: creation is handled atomically by the provision_new_user trigger; remove the
-- self-referential client INSERT policy that depended on current_workspace_id() of a not-yet-existing profile.
DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
REVOKE INSERT ON public.profiles FROM authenticated, anon;
