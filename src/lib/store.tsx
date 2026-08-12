import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, describeError } from "@/lib/zari/supabase";
import type { Database } from "@/lib/zari/database.types";

export type Category = "Clothing" | "Accessories";

export interface Product {
  id: string;
  name: string;
  price: number;
  category: Category;
  image: string;
  description: string;
  stock?: number | null;
  features: string[];
  mockups: string[];
}

export interface CartItem extends Product {
  qty: number;
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: "Admin" | "Customer";
}

interface StoreContextValue {
  products: Product[];
  productsLoading: boolean;
  productsError: string | null;
  refreshProducts: () => Promise<void>;
  addProduct: (p: Omit<Product, "id">) => Promise<void>;
  updateProduct: (id: string, patch: Partial<Omit<Product, "id">>) => Promise<void>;
  removeProduct: (id: string) => Promise<void>;

  cart: CartItem[];
  cartLoading: boolean;
  addToCart: (p: Product, qty?: number) => void;
  removeFromCart: (id: string) => void;
  updateQty: (id: string, qty: number) => void;
  cartOpen: boolean;
  setCartOpen: (v: boolean) => void;
  cartCount: number;
  cartTotal: number;
  placeOrder: (shippingAddress?: string) => Promise<string>;

  user: User | null;
  authLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: {
    email: string;
    password: string;
    fullName: string;
    phone?: string;
  }) => Promise<{ needsEmailConfirmation: boolean }>;
  /** TEMPORARY testing auth — real anonymous Supabase session. See src/lib/zari/test-auth.ts */
  signInAsTestUser: () => Promise<void>;
  logout: () => Promise<void>;
}

const StoreContext = createContext<StoreContextValue | null>(null);

const GUEST_CART_KEY = "zari-cart";
const BASE_PRODUCT_COLUMNS = "id,name,price,category,image_url,description,stock,created_at";
// features/mockups power the highlight chips and the 6-shot gallery. They are added by
// supabase/zari-project.sql; until that script is run the app degrades to single-image
// products instead of erroring, so the storefront is never blank.
const FULL_PRODUCT_COLUMNS = `${BASE_PRODUCT_COLUMNS},features,mockups`;
let galleryColumns = true;
const productColumns = () => (galleryColumns ? FULL_PRODUCT_COLUMNS : BASE_PRODUCT_COLUMNS);
const MISSING_COLUMN = "42703";

type ProductRow = {
  id: string;
  name: string;
  price: number | string;
  category: string;
  image_url: string | null;
  description: string | null;
  stock: number | null;
  features?: string[] | null;
  mockups?: string[] | null;
};

function rowToProduct(r: ProductRow): Product {
  return {
    id: r.id,
    name: r.name,
    price: Number(r.price),
    category: (r.category === "Accessories" ? "Accessories" : "Clothing") as Category,
    image: r.image_url ?? "",
    description: r.description ?? "",
    stock: r.stock,
    features: r.features ?? [],
    mockups: r.mockups?.length ? r.mockups : r.image_url ? [r.image_url] : [],
  };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState<string | null>(null);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartLoading, setCartLoading] = useState(false);
  const [cartHydrated, setCartHydrated] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);

  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // id of the signed-in shopper's carts row; null while signed out
  const cartIdRef = useRef<string | null>(null);
  // product_id -> cart_items.id, so quantity edits patch the right row
  const cartRowsRef = useRef<Map<string, string>>(new Map());
  const productsRef = useRef<Product[]>([]);
  productsRef.current = products;

  /* ------------------------------------------------------------------ products */

  const refreshProducts = useCallback(async () => {
    setProductsLoading(true);
    let { data, error } = await supabase
      .from("products")
      .select(productColumns())
      .order("created_at", { ascending: false });
    if (error?.code === MISSING_COLUMN && galleryColumns) {
      galleryColumns = false;
      ({ data, error } = await supabase
        .from("products")
        .select(productColumns())
        .order("created_at", { ascending: false }));
    }
    if (error) {
      setProductsError(describeError(error, "Could not load the collection."));
    } else {
      setProductsError(null);
      setProducts((data as unknown as ProductRow[]).map(rowToProduct));
    }
    setProductsLoading(false);
  }, []);

  useEffect(() => {
    void refreshProducts();
    const channel = supabase
      .channel("zari-products")
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => {
        void refreshProducts();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [refreshProducts]);

  /* --------------------------------------------------------------------- auth */

  const hydrateUser = useCallback(async (session: Session | null): Promise<User | null> => {
    if (!session?.user) return null;
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, full_name, role")
      .eq("id", session.user.id)
      .maybeSingle();
    // Authorization comes from the database row (and is enforced again by RLS on
    // every write) — never from the signed-in email address.
    const role = (profile?.role ?? "").toString().toLowerCase() === "admin" ? "Admin" : "Customer";
    return {
      id: session.user.id,
      email: session.user.email ?? "",
      fullName: profile?.full_name ?? (session.user.user_metadata?.full_name as string) ?? "",
      role,
    };
  }, []);

  useEffect(() => {
    let active = true;
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "TOKEN_REFRESHED") return;
      // Defer async work: Supabase forbids awaiting inside the callback.
      setTimeout(() => {
        void hydrateUser(session).then((u) => {
          if (!active) return;
          setUser(u);
          setAuthLoading(false);
        });
      }, 0);
    });
    void supabase.auth.getSession().then(({ data }) => {
      void hydrateUser(data.session).then((u) => {
        if (!active) return;
        setUser(u);
        setAuthLoading(false);
      });
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [hydrateUser]);

  /* --------------------------------------------------------------------- cart */

  // Guest cart lives in localStorage; hydrate after mount to avoid SSR mismatch.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(GUEST_CART_KEY);
      if (stored) setCart(JSON.parse(stored) as CartItem[]);
    } catch {
      /* ignore malformed storage */
    }
    setCartHydrated(true);
  }, []);

  useEffect(() => {
    if (!cartHydrated || user) return;
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify(cart));
  }, [cart, cartHydrated, user]);

  const ensureCart = useCallback(async (userId: string): Promise<string> => {
    if (cartIdRef.current) return cartIdRef.current;
    const { data: existing, error } = await supabase
      .from("carts")
      .select("id")
      .eq("user_id", userId)
      .order("created_at")
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (existing?.id) {
      cartIdRef.current = existing.id;
      return existing.id;
    }
    const { data: created, error: insErr } = await supabase
      .from("carts")
      .insert({ user_id: userId })
      .select("id")
      .single();
    if (insErr) throw insErr;
    cartIdRef.current = created.id;
    return created.id;
  }, []);

  const loadServerCart = useCallback(async (cartId: string) => {
    const { data, error } = await supabase
      .from("cart_items")
      .select(`id, product_id, quantity, products(${productColumns()})`)
      .eq("cart_id", cartId);
    if (error) throw error;
    const rows = (data ?? []) as unknown as {
      id: string;
      product_id: string;
      quantity: number;
      products: ProductRow | null;
    }[];
    const map = new Map<string, string>();
    const items: CartItem[] = [];
    for (const row of rows) {
      map.set(row.product_id, row.id);
      const product = row.products
        ? rowToProduct(row.products)
        : productsRef.current.find((p) => p.id === row.product_id);
      if (product) items.push({ ...product, qty: row.quantity });
    }
    cartRowsRef.current = map;
    setCart(items);
  }, []);

  // On sign-in: merge whatever the guest added, then mirror the database cart.
  // On sign-out: drop the server cart from memory.
  useEffect(() => {
    if (!cartHydrated) return;
    let active = true;
    (async () => {
      if (!user) {
        cartIdRef.current = null;
        cartRowsRef.current = new Map();
        try {
          const stored = localStorage.getItem(GUEST_CART_KEY);
          setCart(stored ? (JSON.parse(stored) as CartItem[]) : []);
        } catch {
          setCart([]);
        }
        return;
      }
      setCartLoading(true);
      try {
        const cartId = await ensureCart(user.id);
        await loadServerCart(cartId);
        if (!active) return;

        let pending: CartItem[] = [];
        try {
          pending = JSON.parse(localStorage.getItem(GUEST_CART_KEY) ?? "[]") as CartItem[];
        } catch {
          pending = [];
        }
        if (pending.length) {
          for (const item of pending) {
            const existingRow = cartRowsRef.current.get(item.id);
            if (existingRow) {
              const current = cart.find((c) => c.id === item.id)?.qty ?? 0;
              await supabase
                .from("cart_items")
                .update({ quantity: current + item.qty })
                .eq("id", existingRow);
            } else {
              await supabase
                .from("cart_items")
                .insert({ cart_id: cartId, product_id: item.id, quantity: item.qty });
            }
          }
          localStorage.removeItem(GUEST_CART_KEY);
          await loadServerCart(cartId);
        }
      } catch {
        /* cart stays as-is; UI shows what it has */
      } finally {
        if (active) setCartLoading(false);
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, cartHydrated, ensureCart, loadServerCart]);

  const addToCart = useCallback(
    (product: Product, qty = 1) => {
      setCart((prev) => {
        const found = prev.find((i) => i.id === product.id);
        return found
          ? prev.map((i) => (i.id === product.id ? { ...i, qty: i.qty + qty } : i))
          : [...prev, { ...product, qty }];
      });
      if (!user) return;
      void (async () => {
        try {
          const cartId = await ensureCart(user.id);
          const rowId = cartRowsRef.current.get(product.id);
          if (rowId) {
            const existingQty = cart.find((i) => i.id === product.id)?.qty ?? 0;
            await supabase
              .from("cart_items")
              .update({ quantity: existingQty + qty })
              .eq("id", rowId);
          } else {
            const { data } = await supabase
              .from("cart_items")
              .insert({ cart_id: cartId, product_id: product.id, quantity: qty })
              .select("id")
              .single();
            if (data?.id) cartRowsRef.current.set(product.id, data.id);
          }
        } catch {
          /* keep the optimistic item; a refresh re-syncs from the database */
        }
      })();
    },
    [cart, ensureCart, user],
  );

  const updateQty = useCallback(
    (id: string, qty: number) => {
      setCart((prev) =>
        qty <= 0 ? prev.filter((i) => i.id !== id) : prev.map((i) => (i.id === id ? { ...i, qty } : i)),
      );
      if (!user) return;
      const rowId = cartRowsRef.current.get(id);
      if (!rowId) return;
      void (async () => {
        if (qty <= 0) {
          await supabase.from("cart_items").delete().eq("id", rowId);
          cartRowsRef.current.delete(id);
        } else {
          await supabase.from("cart_items").update({ quantity: qty }).eq("id", rowId);
        }
      })();
    },
    [user],
  );

  const removeFromCart = useCallback(
    (id: string) => {
      setCart((prev) => prev.filter((i) => i.id !== id));
      if (!user) return;
      const rowId = cartRowsRef.current.get(id);
      if (!rowId) return;
      void (async () => {
        await supabase.from("cart_items").delete().eq("id", rowId);
        cartRowsRef.current.delete(id);
      })();
    },
    [user],
  );

  const placeOrder = useCallback(
    async (shippingAddress?: string) => {
      if (!user) throw new Error("Please sign in to place your order.");
      // The total is computed inside the database function from products.price —
      // nothing about the amount is taken from the browser.
      const { data, error } = await supabase.rpc("create_zari_order", {
        p_shipping_address: shippingAddress ?? null,
      });
      if (error) throw new Error(describeError(error, "Could not place your order."));
      cartRowsRef.current = new Map();
      setCart([]);
      return data as unknown as string;
    },
    [user],
  );

  /* ------------------------------------------------------------------ admin CRUD */

  const addProduct = useCallback(
    async (p: Omit<Product, "id">) => {
      const { error } = await supabase.from("products").insert({
        name: p.name,
        price: p.price,
        category: p.category,
        image_url: p.image,
        description: p.description,
        ...(galleryColumns ? { features: p.features, mockups: p.mockups } : {}),
        ...(p.stock !== null && p.stock !== undefined ? { stock: p.stock } : {}),
      });
      if (error) throw new Error(describeError(error, "Could not add the product."));
      await refreshProducts();
    },
    [refreshProducts],
  );

  const updateProduct = useCallback(
    async (id: string, patch: Partial<Omit<Product, "id">>) => {
      const dbPatch: Database["public"]["Tables"]["products"]["Update"] = {};
      if (patch.name !== undefined) dbPatch.name = patch.name;
      if (patch.price !== undefined) dbPatch.price = patch.price;
      if (patch.category !== undefined) dbPatch.category = patch.category;
      if (patch.image !== undefined) dbPatch.image_url = patch.image;
      if (patch.description !== undefined) dbPatch.description = patch.description;
      if (galleryColumns && patch.features !== undefined) dbPatch.features = patch.features;
      if (galleryColumns && patch.mockups !== undefined) dbPatch.mockups = patch.mockups;
      if (patch.stock !== undefined && patch.stock !== null) dbPatch.stock = patch.stock;
      const { error } = await supabase.from("products").update(dbPatch).eq("id", id);
      if (error) throw new Error(describeError(error, "Could not update the product."));
      await refreshProducts();
    },
    [refreshProducts],
  );

  const removeProduct = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw new Error(describeError(error, "Could not remove the product."));
      await refreshProducts();
    },
    [refreshProducts],
  );

  /* --------------------------------------------------------------- auth actions */

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) {
      const lower = error.message.toLowerCase();
      if (lower.includes("invalid login credentials")) throw new Error("Invalid email or password.");
      if (lower.includes("email not confirmed")) {
        throw new Error("Please confirm your email from the link we sent, then sign in.");
      }
      throw new Error(describeError(error, "Sign in failed."));
    }
  }, []);

  const signUp = useCallback(
    async ({
      email,
      password,
      fullName,
      phone,
    }: {
      email: string;
      password: string;
      fullName: string;
      phone?: string;
    }) => {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          // Read by the project's auth trigger when it creates the profiles row.
          data: { full_name: fullName, phone: phone ?? null },
          emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
        },
      });
      if (error) {
        const lower = error.message.toLowerCase();
        if (lower.includes("already registered") || lower.includes("already been registered")) {
          throw new Error("An account with this email already exists. Try signing in instead.");
        }
        if (lower.includes("rate limit")) {
          throw new Error(
            "Sign-up email limit reached on the backend. For testing, turn off \u201cConfirm email\u201d in your Supabase Auth settings so accounts work without email delivery.",
          );
        }
        throw new Error(describeError(error, "Could not create your account."));
      }
      return { needsEmailConfirmation: !data.session };
    },
    [],
  );

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    cartIdRef.current = null;
    cartRowsRef.current = new Map();
    setCart([]);
  }, []);

  const value = useMemo<StoreContextValue>(() => {
    const cartCount = cart.reduce((n, i) => n + i.qty, 0);
    const cartTotal = cart.reduce((n, i) => n + i.qty * i.price, 0);
    return {
      products,
      productsLoading,
      productsError,
      refreshProducts,
      addProduct,
      updateProduct,
      removeProduct,
      cart,
      cartLoading,
      addToCart,
      removeFromCart,
      updateQty,
      cartOpen,
      setCartOpen,
      cartCount,
      cartTotal,
      placeOrder,
      user,
      authLoading,
      signIn,
      signUp,
      logout,
    };
  }, [
    products,
    productsLoading,
    productsError,
    refreshProducts,
    addProduct,
    updateProduct,
    removeProduct,
    cart,
    cartLoading,
    addToCart,
    removeFromCart,
    updateQty,
    cartOpen,
    placeOrder,
    user,
    authLoading,
    signIn,
    signUp,
    logout,
  ]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
