DROP VIEW IF EXISTS public.reviews_public;

DROP POLICY IF EXISTS "Users read own reviews" ON public.reviews;
DROP POLICY IF EXISTS "Admins read all reviews" ON public.reviews;

CREATE POLICY "Reviews are viewable by everyone"
ON public.reviews FOR SELECT USING (true);

REVOKE SELECT ON public.reviews FROM anon, authenticated;
GRANT SELECT (id, product_id, name, rating, comment, created_at) ON public.reviews TO anon;
GRANT SELECT (id, product_id, name, rating, comment, created_at, user_id) ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;