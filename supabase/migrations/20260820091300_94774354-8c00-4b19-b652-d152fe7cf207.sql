CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  shipping_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own orders" ON public.orders;
CREATE POLICY "Users read own orders" ON public.orders FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins read all orders" ON public.orders;
CREATE POLICY "Admins read all orders" ON public.orders FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'Admin'));
CREATE INDEX IF NOT EXISTS orders_user_idx ON public.orders(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  name text NOT NULL,
  unit_price numeric NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own order items" ON public.order_items;
CREATE POLICY "Users read own order items" ON public.order_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid()));
DROP POLICY IF EXISTS "Admins read all order items" ON public.order_items;
CREATE POLICY "Admins read all order items" ON public.order_items FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'Admin'));
CREATE INDEX IF NOT EXISTS order_items_order_idx ON public.order_items(order_id);

-- Places an order from the caller's own cart. Totals come from products.price,
-- never from the browser. Clears the cart afterwards.
CREATE OR REPLACE FUNCTION public.create_zari_order(p_shipping_address text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_cart uuid;
  v_order uuid;
  v_total numeric;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id INTO v_cart FROM public.carts WHERE user_id = v_user ORDER BY created_at LIMIT 1;
  IF v_cart IS NULL THEN
    RAISE EXCEPTION 'Your bag is empty';
  END IF;

  SELECT COALESCE(SUM(p.price * ci.quantity), 0) INTO v_total
    FROM public.cart_items ci JOIN public.products p ON p.id = ci.product_id
   WHERE ci.cart_id = v_cart;

  IF v_total = 0 THEN
    RAISE EXCEPTION 'Your bag is empty';
  END IF;

  INSERT INTO public.orders (user_id, total, shipping_address)
  VALUES (v_user, v_total, p_shipping_address)
  RETURNING id INTO v_order;

  INSERT INTO public.order_items (order_id, product_id, name, unit_price, quantity)
  SELECT v_order, p.id, p.name, p.price, ci.quantity
    FROM public.cart_items ci JOIN public.products p ON p.id = ci.product_id
   WHERE ci.cart_id = v_cart;

  DELETE FROM public.cart_items WHERE cart_id = v_cart;
  RETURN v_order;
END;
$$;

REVOKE ALL ON FUNCTION public.create_zari_order(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_zari_order(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_zari_order(text) TO service_role;