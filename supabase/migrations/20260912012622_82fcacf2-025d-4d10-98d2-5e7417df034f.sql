-- 1) Safe profile self-insert: id must be the caller and workspace must be caller's current workspace
CREATE POLICY "profiles_insert_own"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid() AND workspace_id = public.current_workspace_id());

-- 2) user_roles: no client writes at all — assignment happens only via service_role / definer triggers
REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM anon;

-- 3) Workspace creation automatically binds creator as owner and links their profile
CREATE OR REPLACE FUNCTION public.bind_workspace_creator()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (auth.uid(), 'owner')
  ON CONFLICT (user_id, role) DO NOTHING;
  UPDATE public.profiles SET workspace_id = NEW.id WHERE id = auth.uid();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.bind_workspace_creator() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_workspace_created ON public.workspaces;
CREATE TRIGGER on_workspace_created
AFTER INSERT ON public.workspaces
FOR EACH ROW EXECUTE FUNCTION public.bind_workspace_creator();
