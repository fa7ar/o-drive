CREATE OR REPLACE FUNCTION public.current_workspace_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$ SELECT workspace_id FROM public.profiles WHERE id = auth.uid() $$;