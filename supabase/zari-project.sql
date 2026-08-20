-- Run this ONCE in the SQL editor of the Zari Supabase project (ref: ubmxuhzlvyjomuopcoxk).
-- It is additive and safe to re-run. It does not recreate or drop any existing table.
--
-- 1) reviews.reviewer_name — the display name shown next to a review. reviews.user_id
--    references auth.users, so the app cannot read another shopper's profile to render
--    a name; storing the name the reviewer chose keeps reviews public-readable without
--    exposing account rows.
-- 2) create_zari_order() — builds an order server-side. The browser never sends a total:
--    it is recalculated from products.price, so a tampered client cannot underpay.

ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS reviewer_name text;

CREATE OR REPLACE FUNCTION public.create_zari_order(p_shipping_address text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user  uuid := auth.uid();
  v_cart  uuid;
  v_total numeric;
  v_order uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to place an order.';
  END IF;

  SELECT id INTO v_cart
  FROM public.carts
  WHERE user_id = v_user
  ORDER BY created_at
  LIMIT 1;

  IF v_cart IS NULL THEN
    RAISE EXCEPTION 'Your bag is empty.';
  END IF;

  -- Authoritative total: product prices from the database, never from the client.
  SELECT COALESCE(SUM(ci.quantity * p.price), 0) INTO v_total
  FROM public.cart_items ci
  JOIN public.products p ON p.id = ci.product_id
  WHERE ci.cart_id = v_cart;

  IF v_total <= 0 THEN
    RAISE EXCEPTION 'Your bag is empty.';
  END IF;

  INSERT INTO public.orders (user_id, total, shipping_address)
  VALUES (v_user, v_total, p_shipping_address)
  RETURNING id INTO v_order;

  INSERT INTO public.order_items (order_id, product_id, quantity, unit_price)
  SELECT v_order, ci.product_id, ci.quantity, p.price
  FROM public.cart_items ci
  JOIN public.products p ON p.id = ci.product_id
  WHERE ci.cart_id = v_cart;

  DELETE FROM public.cart_items WHERE cart_id = v_cart;

  RETURN v_order;
END;
$$;

REVOKE ALL ON FUNCTION public.create_zari_order(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_zari_order(text) TO authenticated;

-- 3) products.features / products.mockups — the storefront ships a highlight-chip list
--    and a multi-image gallery (up to 6 shots) per product. Additive text[] columns with
--    empty-array defaults, so existing rows and existing queries keep working.
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS features text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS mockups text[] NOT NULL DEFAULT '{}';

-- 4) wishlist_items / recently_viewed — server-side persistence for the Wishlist and
--    Recently Viewed features. Both are strictly per-user: RLS scopes every row to
--    auth.uid(), so a shopper can never read or write another account's lists.
--    Guests keep the same lists in localStorage and they merge in on sign-in.
CREATE TABLE IF NOT EXISTS public.wishlist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);
CREATE INDEX IF NOT EXISTS wishlist_items_user_created_idx
  ON public.wishlist_items (user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wishlist_items TO authenticated;
GRANT ALL ON public.wishlist_items TO service_role;
ALTER TABLE public.wishlist_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own wishlist" ON public.wishlist_items;
CREATE POLICY "Users manage their own wishlist"
  ON public.wishlist_items FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.recently_viewed (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);
CREATE INDEX IF NOT EXISTS recently_viewed_user_viewed_idx
  ON public.recently_viewed (user_id, viewed_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recently_viewed TO authenticated;
GRANT ALL ON public.recently_viewed TO service_role;
ALTER TABLE public.recently_viewed ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own view history" ON public.recently_viewed;
CREATE POLICY "Users manage their own view history"
  ON public.recently_viewed FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
