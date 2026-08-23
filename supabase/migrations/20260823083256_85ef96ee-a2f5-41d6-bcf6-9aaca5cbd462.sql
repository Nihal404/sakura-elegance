-- Anonymous callers never need the role check: no anon policy references it.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
-- authenticated must keep EXECUTE: RLS policies on products, banners, orders,
-- order_items, reviews and storage.objects evaluate these helpers as the caller.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;