REVOKE ALL ON FUNCTION public.provision_new_user() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.has_role(UUID, public.app_role) FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.touch_updated_at() FROM anon, authenticated, public;