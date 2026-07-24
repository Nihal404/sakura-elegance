-- Ensure the handle_new_user trigger is attached to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill: ensure any existing admin user has an Admin role + profile row
INSERT INTO public.profiles (id, email)
SELECT u.id, u.email FROM auth.users u
WHERE lower(u.email) = 'admin@zariboutique.com'
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'Admin'::app_role FROM auth.users u
WHERE lower(u.email) = 'admin@zariboutique.com'
ON CONFLICT (user_id, role) DO NOTHING;