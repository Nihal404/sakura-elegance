-- Harden the admin authorization helper.
-- SECURITY DEFINER is required so the role lookup does not depend on the caller's
-- RLS visibility of public.user_roles (an invoker-rights check silently returns
-- false if that SELECT policy ever narrows, and cannot be used from other
-- definer contexts). No dynamic SQL, fixed search_path, single fixed table read.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon, authenticated, service_role;

-- Caller-scoped admin check: cannot be asked about another user's privileges.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM public.user_roles
       WHERE user_id = auth.uid() AND role = 'Admin'::public.app_role
     )
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

-- Products: public read, admin-only writes (idempotent re-statement).
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Products are viewable by everyone" ON public.products;
CREATE POLICY "Products are viewable by everyone"
  ON public.products FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Admins can insert products" ON public.products;
CREATE POLICY "Admins can insert products"
  ON public.products FOR INSERT TO authenticated WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "Admins can update products" ON public.products;
CREATE POLICY "Admins can update products"
  ON public.products FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "Admins can delete products" ON public.products;
CREATE POLICY "Admins can delete products"
  ON public.products FOR DELETE TO authenticated USING (public.is_admin());

-- Banners: same shape.
DROP POLICY IF EXISTS "Admins can insert banners" ON public.banners;
CREATE POLICY "Admins can insert banners"
  ON public.banners FOR INSERT TO authenticated WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "Admins can update banners" ON public.banners;
CREATE POLICY "Admins can update banners"
  ON public.banners FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "Admins can delete banners" ON public.banners;
CREATE POLICY "Admins can delete banners"
  ON public.banners FOR DELETE TO authenticated USING (public.is_admin());

-- Storage: product images publicly readable, writes admin-only, restricted to
-- the product-images bucket on both sides of UPDATE so an object cannot be
-- moved into or out of another bucket.
DROP POLICY IF EXISTS "Product images publicly readable" ON storage.objects;
CREATE POLICY "Product images publicly readable"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'product-images');
DROP POLICY IF EXISTS "Admins upload product images" ON storage.objects;
CREATE POLICY "Admins upload product images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-images' AND public.is_admin());
DROP POLICY IF EXISTS "Admins update product images" ON storage.objects;
CREATE POLICY "Admins update product images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'product-images' AND public.is_admin())
  WITH CHECK (bucket_id = 'product-images' AND public.is_admin());
DROP POLICY IF EXISTS "Admins delete product images" ON storage.objects;
CREATE POLICY "Admins delete product images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'product-images' AND public.is_admin());

-- Roles and profiles are read-only to clients: no INSERT/UPDATE/DELETE policies
-- exist, so no customer can grant themselves or anyone else the Admin role.
-- Re-assert grants without write privileges on user_roles.
REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.profiles FROM authenticated, anon;
REVOKE ALL ON public.user_roles FROM anon;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT SELECT ON public.profiles TO authenticated;