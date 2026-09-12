
-- Guard trigger: authenticated users can never change their workspace assignment;
-- trusted server-side roles (service_role) still can.
CREATE OR REPLACE FUNCTION public.guard_profile_workspace()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.workspace_id IS DISTINCT FROM OLD.workspace_id
     AND coalesce(auth.jwt() ->> 'role', '') = 'authenticated' THEN
    RAISE EXCEPTION 'workspace assignment cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_guard_workspace ON public.profiles;
CREATE TRIGGER profiles_guard_workspace
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_workspace();

-- Simplify the update policy: the trigger now enforces the workspace invariant.
DROP POLICY IF EXISTS profiles_own_update ON public.profiles;
CREATE POLICY profiles_own_update ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- No longer needed by any policy: revoke direct execution from signed-in users.
REVOKE EXECUTE ON FUNCTION public.current_profile_workspace_id() FROM authenticated, anon, public;
