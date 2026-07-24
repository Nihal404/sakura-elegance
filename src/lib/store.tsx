import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";

export type Category = "Clothing" | "Accessories";

export interface Product {
  id: string;
  name: string;
  price: number;
  category: Category;
  image: string;
  description: string;
  features: string[];
  mockups: string[];
}

export interface CartItem extends Product {
  qty: number;
}

export interface User {
  id: string;
  email: string;
  role: "Admin" | "Customer";
}

interface StoreContextValue {
  products: Product[];
  productsLoading: boolean;
  refreshProducts: () => Promise<void>;
  addProduct: (p: Omit<Product, "id">) => Promise<void>;
  updateProduct: (id: string, patch: Partial<Omit<Product, "id">>) => Promise<void>;
  removeProduct: (id: string) => Promise<void>;

  cart: CartItem[];
  addToCart: (p: Product) => void;
  removeFromCart: (id: string) => void;
  updateQty: (id: string, qty: number) => void;
  cartOpen: boolean;
  setCartOpen: (v: boolean) => void;
  cartCount: number;
  cartTotal: number;

  user: User | null;
  authLoading: boolean;
  logout: () => Promise<void>;
}

const StoreContext = createContext<StoreContextValue | null>(null);

type ProductRow = {
  id: string;
  name: string;
  price: number | string;
  category: string;
  image_url: string;
  description: string | null;
  features: string[] | null;
};

function rowToProduct(r: ProductRow): Product {
  return {
    id: r.id,
    name: r.name,
    price: Number(r.price),
    category: r.category as Category,
    image: r.image_url,
    description: r.description ?? "",
    features: r.features ?? [],
  };
}

async function hydrateUser(session: Session | null): Promise<User | null> {
  if (!session?.user) return null;
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", session.user.id);
  const isAdmin = (data ?? []).some((r) => r.role === "Admin");
  return {
    id: session.user.id,
    email: session.user.email ?? "",
    role: isAdmin ? "Admin" : "Customer",
  };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartHydrated, setCartHydrated] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Hydrate cart from localStorage after mount (avoids SSR mismatch)
  useEffect(() => {
    try {
      const stored = localStorage.getItem("zari-cart");
      if (stored) setCart(JSON.parse(stored));
    } catch {
      /* ignore */
    }
    setCartHydrated(true);
  }, []);

  // Persist cart only after hydration
  useEffect(() => {
    if (!cartHydrated) return;
    localStorage.setItem("zari-cart", JSON.stringify(cart));
  }, [cart, cartHydrated]);

  const refreshProducts = async () => {
    setProductsLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("id,name,price,category,image_url,description,features")
      .order("created_at", { ascending: false });
    if (!error && data) setProducts((data as unknown as ProductRow[]).map(rowToProduct));
    setProductsLoading(false);
  };

  // Initial fetch + realtime updates
  useEffect(() => {
    refreshProducts();
    const channel = supabase
      .channel("products-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products" },
        () => {
          refreshProducts();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Auth session
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      // Defer async work to avoid deadlock
      setTimeout(() => {
        hydrateUser(session).then((u) => {
          setUser(u);
          setAuthLoading(false);
        });
      }, 0);
    });
    supabase.auth.getSession().then(({ data }) => {
      hydrateUser(data.session).then((u) => {
        setUser(u);
        setAuthLoading(false);
      });
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const value = useMemo<StoreContextValue>(() => {
    const cartCount = cart.reduce((n, i) => n + i.qty, 0);
    const cartTotal = cart.reduce((n, i) => n + i.qty * i.price, 0);
    return {
      products,
      productsLoading,
      refreshProducts,
      addProduct: async (p) => {
        const { error } = await supabase.from("products").insert({
          name: p.name,
          price: p.price,
          category: p.category,
          image_url: p.image,
          description: p.description,
          features: p.features,
        });
        if (error) throw error;
        await refreshProducts();
      },
      updateProduct: async (id, patch) => {
        const dbPatch: {
          name?: string;
          price?: number;
          category?: string;
          image_url?: string;
          description?: string;
          features?: string[];
        } = {};
        if (patch.name !== undefined) dbPatch.name = patch.name;
        if (patch.price !== undefined) dbPatch.price = patch.price;
        if (patch.category !== undefined) dbPatch.category = patch.category;
        if (patch.image !== undefined) dbPatch.image_url = patch.image;
        if (patch.description !== undefined) dbPatch.description = patch.description;
        if (patch.features !== undefined) dbPatch.features = patch.features;
        const { error } = await supabase.from("products").update(dbPatch).eq("id", id);
        if (error) throw error;
        await refreshProducts();
      },
      removeProduct: async (id) => {
        const { error } = await supabase.from("products").delete().eq("id", id);
        if (error) throw error;
        await refreshProducts();
      },
      cart,
      addToCart: (p) =>
        setCart((prev) => {
          const found = prev.find((i) => i.id === p.id);
          if (found)
            return prev.map((i) =>
              i.id === p.id ? { ...i, qty: i.qty + 1 } : i,
            );
          return [...prev, { ...p, qty: 1 }];
        }),
      removeFromCart: (id) => setCart((prev) => prev.filter((i) => i.id !== id)),
      updateQty: (id, qty) =>
        setCart((prev) =>
          qty <= 0
            ? prev.filter((i) => i.id !== id)
            : prev.map((i) => (i.id === id ? { ...i, qty } : i)),
        ),
      cartOpen,
      setCartOpen,
      cartCount,
      cartTotal,
      user,
      authLoading,
      logout: async () => {
        await supabase.auth.signOut();
      },
    };
  }, [products, productsLoading, cart, cartOpen, user, authLoading]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
