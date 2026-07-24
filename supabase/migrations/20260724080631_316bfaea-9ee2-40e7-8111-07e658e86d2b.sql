
-- Roles
CREATE TYPE public.app_role AS ENUM ('Admin', 'Customer');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);

-- Auto profile + role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email) VALUES (NEW.id, NEW.email);
  IF lower(NEW.email) = 'admin@zariboutique.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'Admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'Customer');
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Products
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  price numeric(10,2) NOT NULL CHECK (price >= 0),
  category text NOT NULL CHECK (category IN ('Clothing','Accessories')),
  image_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.products TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Products are viewable by everyone" ON public.products FOR SELECT USING (true);
CREATE POLICY "Admins can insert products" ON public.products FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'Admin'));
CREATE POLICY "Admins can update products" ON public.products FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'Admin'));
CREATE POLICY "Admins can delete products" ON public.products FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'Admin'));

-- Seed initial products
INSERT INTO public.products (name, price, category, image_url) VALUES
  ('Blossom Silk Saree', 189, 'Clothing', 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=800&q=80'),
  ('Rose Petal Dress', 149, 'Clothing', 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=800&q=80'),
  ('Ivory Lace Kurti', 89, 'Clothing', 'https://images.unsplash.com/photo-1583391733956-6c78276477e2?w=800&q=80'),
  ('Sakura Chiffon Gown', 229, 'Clothing', 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=800&q=80'),
  ('Rose Gold Pearl Earrings', 59, 'Accessories', 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800&q=80'),
  ('Blush Silk Scarf', 39, 'Accessories', 'https://images.unsplash.com/photo-1601924994987-69e26d50dc26?w=800&q=80'),
  ('Petal Charm Bracelet', 69, 'Accessories', 'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=800&q=80'),
  ('Cherry Blossom Clutch', 119, 'Accessories', 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800&q=80');
