CREATE OR REPLACE FUNCTION public.bind_workspace_creator()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (uid, 'owner')
  ON CONFLICT (user_id, role) DO NOTHING;
  UPDATE public.profiles SET workspace_id = NEW.id WHERE id = uid;
  RETURN NEW;
END;
$function$;