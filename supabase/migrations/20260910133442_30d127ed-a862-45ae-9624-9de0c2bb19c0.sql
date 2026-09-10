CREATE OR REPLACE FUNCTION public.current_workspace_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$ SELECT workspace_id FROM public.profiles WHERE id = auth.uid() $$;

REVOKE EXECUTE ON FUNCTION public.current_workspace_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_workspace_id() TO authenticated, service_role;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'connections','drives','files','jobs','transfers','sync_jobs','sync_history',
    'automations','automation_runs','api_keys','api_request_logs',
    'webhook_endpoints','shares','system_logs','activity_logs',
    'workspace_settings','feature_flags','config_entries','provider_states','modules'
  ]
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('DROP POLICY IF EXISTS "workspace_members_manage" ON public.%I', t);
    EXECUTE format($f$CREATE POLICY "workspace_members_manage" ON public.%I FOR ALL TO authenticated
      USING (workspace_id = public.current_workspace_id())
      WITH CHECK (workspace_id = public.current_workspace_id())$f$, t);
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_logs TO authenticated;
GRANT ALL ON public.job_logs TO service_role;
CREATE POLICY "workspace_members_manage" ON public.job_logs FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_logs.job_id AND j.workspace_id = public.current_workspace_id()))
WITH CHECK (EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_logs.job_id AND j.workspace_id = public.current_workspace_id()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_run_actions TO authenticated;
GRANT ALL ON public.automation_run_actions TO service_role;
CREATE POLICY "workspace_members_manage" ON public.automation_run_actions FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.automation_runs r WHERE r.id = automation_run_actions.run_id AND r.workspace_id = public.current_workspace_id()))
WITH CHECK (EXISTS (SELECT 1 FROM public.automation_runs r WHERE r.id = automation_run_actions.run_id AND r.workspace_id = public.current_workspace_id()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.share_access_logs TO authenticated;
GRANT ALL ON public.share_access_logs TO service_role;
CREATE POLICY "workspace_members_manage" ON public.share_access_logs FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.shares s WHERE s.id = share_access_logs.share_id AND s.workspace_id = public.current_workspace_id()))
WITH CHECK (EXISTS (SELECT 1 FROM public.shares s WHERE s.id = share_access_logs.share_id AND s.workspace_id = public.current_workspace_id()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.webhook_deliveries TO authenticated;
GRANT ALL ON public.webhook_deliveries TO service_role;
CREATE POLICY "workspace_members_manage" ON public.webhook_deliveries FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.webhook_endpoints e WHERE e.id = webhook_deliveries.endpoint_id AND e.workspace_id = public.current_workspace_id()))
WITH CHECK (EXISTS (SELECT 1 FROM public.webhook_endpoints e WHERE e.id = webhook_deliveries.endpoint_id AND e.workspace_id = public.current_workspace_id()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.credentials TO authenticated;
GRANT ALL ON public.credentials TO service_role;
CREATE POLICY "workspace_admins_manage_credentials" ON public.credentials FOR ALL TO authenticated
USING (workspace_id = public.current_workspace_id() AND (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin')))
WITH CHECK (workspace_id = public.current_workspace_id() AND (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin')));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.connection_tokens TO authenticated;
GRANT ALL ON public.connection_tokens TO service_role;
CREATE POLICY "workspace_admins_manage_connection_tokens" ON public.connection_tokens FOR ALL TO authenticated
USING (
  (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'))
  AND EXISTS (SELECT 1 FROM public.connections c WHERE c.id = connection_tokens.connection_id AND c.workspace_id = public.current_workspace_id())
)
WITH CHECK (
  (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'))
  AND EXISTS (SELECT 1 FROM public.connections c WHERE c.id = connection_tokens.connection_id AND c.workspace_id = public.current_workspace_id())
);

CREATE POLICY "authenticated_can_create_workspace" ON public.workspaces FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "owners_update_workspace" ON public.workspaces FOR UPDATE TO authenticated
USING (id = public.current_workspace_id() AND (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin')))
WITH CHECK (id = public.current_workspace_id() AND (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin')));
CREATE POLICY "owners_delete_workspace" ON public.workspaces FOR DELETE TO authenticated
USING (id = public.current_workspace_id() AND public.has_role(auth.uid(), 'owner'));