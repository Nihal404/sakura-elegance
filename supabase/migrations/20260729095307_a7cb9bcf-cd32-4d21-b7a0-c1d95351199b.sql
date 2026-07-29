
-- 1) email_otps: revoke all client access; only service_role touches it via server functions
REVOKE ALL ON public.email_otps FROM anon, authenticated, PUBLIC;
GRANT ALL ON public.email_otps TO service_role;
-- Explicit deny policies so any accidental future GRANT still blocks client access
DROP POLICY IF EXISTS "Deny all client access to email_otps" ON public.email_otps;
CREATE POLICY "Deny all client access to email_otps"
  ON public.email_otps
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- 2) reviews: require authenticated user and enforce user_id = auth.uid()
DROP POLICY IF EXISTS "Anyone can post a review" ON public.reviews;
CREATE POLICY "Authenticated users can post their own reviews"
  ON public.reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 3) has_role SECURITY DEFINER: restrict EXECUTE
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
