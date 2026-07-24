import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type Category = "Clothing" | "Accessories";

export interface Product {
  id: string;
  name: string;
  price: number;
  category: Category;
  image: string;
}

export interface CartItem extends Product {
  qty: number;
}

export interface User {
  email: string;
  role: "Admin" | "Customer";
}

const ADMIN_EMAIL = "admin@zariboutique.com";

const INITIAL_PRODUCTS: Product[] = [
  {
    id: "p1",
    name: "Blossom Silk Saree",
    price: 189,
    category: "Clothing",
    image: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=800&q=80",
  },
  {
    id: "p2",
    name: "Rose Petal Dress",
    price: 149,
    category: "Clothing",
    image: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=800&q=80",
  },
  {
    id: "p3",
    name: "Ivory Lace Kurti",
    price: 89,
    category: "Clothing",
    image: "https://images.unsplash.com/photo-1583391733956-6c78276477e2?w=800&q=80",
  },
  {
    id: "p4",
    name: "Sakura Chiffon Gown",
    price: 229,
    category: "Clothing",
    image: "https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=800&q=80",
  },
  {
    id: "p5",
    name: "Rose Gold Pearl Earrings",
    price: 59,
    category: "Accessories",
    image: "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800&q=80",
  },
  {
    id: "p6",
    name: "Blush Silk Scarf",
    price: 39,
    category: "Accessories",
    image: "https://images.unsplash.com/photo-1601924994987-69e26d50dc26?w=800&q=80",
  },
  {
    id: "p7",
    name: "Petal Charm Bracelet",
    price: 69,
    category: "Accessories",
    image: "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=800&q=80",
  },
  {
    id: "p8",
    name: "Cherry Blossom Clutch",
    price: 119,
    category: "Accessories",
    image: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800&q=80",
  },
];

interface StoreContextValue {
  products: Product[];
  addProduct: (p: Omit<Product, "id">) => void;
  removeProduct: (id: string) => void;

  cart: CartItem[];
  addToCart: (p: Product) => void;
  removeFromCart: (id: string) => void;
  updateQty: (id: string, qty: number) => void;
  cartOpen: boolean;
  setCartOpen: (v: boolean) => void;
  cartCount: number;
  cartTotal: number;

  user: User | null;
  login: (email: string) => User;
  logout: () => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  const value = useMemo<StoreContextValue>(() => {
    const cartCount = cart.reduce((n, i) => n + i.qty, 0);
    const cartTotal = cart.reduce((n, i) => n + i.qty * i.price, 0);
    return {
      products,
      addProduct: (p) =>
        setProducts((prev) => [{ ...p, id: `p${Date.now()}` }, ...prev]),
      removeProduct: (id) => setProducts((prev) => prev.filter((x) => x.id !== id)),
      cart,
      addToCart: (p) =>
        setCart((prev) => {
          const found = prev.find((i) => i.id === p.id);
          if (found) return prev.map((i) => (i.id === p.id ? { ...i, qty: i.qty + 1 } : i));
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
      login: (email) => {
        const role: User["role"] = email.toLowerCase() === ADMIN_EMAIL ? "Admin" : "Customer";
        const u: User = { email, role };
        setUser(u);
        return u;
      },
      logout: () => setUser(null),
    };
  }, [products, cart, cartOpen, user]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
