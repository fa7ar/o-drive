DROP POLICY IF EXISTS "authenticated_can_create_workspace" ON public.workspaces;
REVOKE INSERT ON public.workspaces FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.create_workspace_for_current_user(_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  new_id uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  INSERT INTO public.workspaces (name) VALUES (coalesce(nullif(_name, ''), 'My Workspace')) RETURNING id INTO new_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (uid, 'owner') ON CONFLICT (user_id, role) DO NOTHING;
  UPDATE public.profiles SET workspace_id = new_id WHERE id = uid;
  INSERT INTO public.workspace_settings (workspace_id, data) VALUES (new_id, '{}'::jsonb) ON CONFLICT (workspace_id) DO NOTHING;
  RETURN new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_workspace_for_current_user(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_workspace_for_current_user(text) TO authenticated;