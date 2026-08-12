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
