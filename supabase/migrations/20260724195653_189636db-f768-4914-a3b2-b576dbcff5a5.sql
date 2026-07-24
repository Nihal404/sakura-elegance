ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;

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