import { Link, useRouterState } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Home, Store, ShoppingBag, Heart } from "lucide-react";
import { useStore } from "@/lib/store";
import { useShoppingLists } from "@/lib/shopping-lists";

const items = [
  { to: "/", label: "Home", Icon: Home },
  { to: "/shop", label: "Shop", Icon: Store },
  { to: "/cart", label: "Cart", Icon: ShoppingBag },
  { to: "/wishlist", label: "Wishlist", Icon: Heart },
] as const;

export function BottomNav() {
  const { cartCount, cartShake } = useStore();
  const { wishlist } = useShoppingLists();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const badgeFor = (to: string) =>
    to === "/cart" ? cartCount : to === "/wishlist" ? wishlist.length : 0;

  return (
    <motion.nav
      initial={{ y: 40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: "easeOut", delay: 0.15 }}
      className="fixed bottom-4 inset-x-0 z-50 px-4 pb-[env(safe-area-inset-bottom)]"
      aria-label="Primary"
    >
      <div className="glass-panel mx-auto flex max-w-md items-center justify-between gap-1 rounded-full px-2 py-2">
        {items.map(({ to, label, Icon }) => {
          const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
          const count = badgeFor(to);
          return (
            <Link
              key={to}
              to={to}
              data-press
              aria-current={active ? "page" : undefined}
              className={`relative flex flex-1 flex-col items-center gap-0.5 rounded-full px-2 py-2 text-[11px] tracking-wide transition-colors ${
                active ? "text-primary font-semibold" : "text-foreground/60 hover:text-primary"
              } ${to === "/cart" && cartShake ? "animate-cart-shake" : ""}`}
            >
              {active && (
                <motion.span
                  layoutId="bottom-nav-active"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  className="glass-active absolute inset-0 rounded-full ring-1 ring-primary/40"
                />
              )}
              <span className="relative">
                <motion.span
                  className="block"
                  animate={active ? { scale: 1.12, y: -1 } : { scale: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 22 }}
                >
                  <Icon className={`h-5 w-5 ${active ? "drop-shadow-sm" : ""}`} />
                </motion.span>
                {count > 0 && (
                  <span className="absolute -top-1.5 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold text-primary-foreground">
                    {count}
                  </span>
                )}
              </span>
              <span className="relative">{label}</span>
              {active && (
                <span className="absolute -bottom-0.5 h-1 w-1 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </div>
    </motion.nav>
  );
}
