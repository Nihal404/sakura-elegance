-- handle_new_user() is an auth.users trigger function; nothing should call it via the API.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;