CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, phone)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'phone');
  IF lower(NEW.email) = 'admin@zariboutique.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'Admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'Customer');
  END IF;
  RETURN NEW;
END;
$function$;

-- Ensure the trigger fires after a new auth user is inserted.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();