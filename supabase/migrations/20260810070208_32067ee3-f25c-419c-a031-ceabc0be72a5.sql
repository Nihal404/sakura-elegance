DROP POLICY IF EXISTS "Reviews are viewable by everyone" ON public.reviews;

CREATE POLICY "Users read own reviews"
ON public.reviews FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins read all reviews"
ON public.reviews FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'Admin'::app_role));

CREATE OR REPLACE VIEW public.reviews_public
WITH (security_invoker = false) AS
SELECT id, product_id, name, rating, comment, created_at
FROM public.reviews;

REVOKE ALL ON public.reviews_public FROM anon, authenticated;
GRANT SELECT ON public.reviews_public TO anon, authenticated;
GRANT ALL ON public.reviews_public TO service_role;