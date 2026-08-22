import { Link, useRouter } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ShoppingBag, User as UserIcon, Menu, X, LogOut, LayoutDashboard, Heart, Clock, Scale } from "lucide-react";
import { useShoppingLists } from "@/lib/shopping-lists";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";

export function Navbar() {
  const { cartCount, user, logout, cartShake } = useStore();
  const { wishlist, compare } = useShoppingLists();

  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!userMenu) return;
    const onDocClick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest("[data-user-menu]")) setUserMenu(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [userMenu]);


  return (
    <motion.header
      initial={{ y: -30, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 ${
        scrolled
          ? "bg-background/85 backdrop-blur-xl shadow-soft border-b border-border/50"
          : "bg-transparent"
      }`}
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-10 h-20 flex items-center justify-between">
        <Link to="/" className="group flex items-center gap-1.5">
          <span className="font-zari font-bold text-[26px] md:text-[32px] tracking-normal text-gold drop-shadow-sm">
            Zari
          </span>
          <span className="font-serif text-[18px] md:text-[22px] tracking-tight text-foreground">
            Boutique
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-10">
          {[
            { to: "/", label: "Home" },
            { to: "/shop", label: "Shop Clothing", search: { category: "Clothing" } },
            { to: "/shop", label: "Shop Accessories", search: { category: "Accessories" } },
          ].map((l) => (
            <Link
              key={l.label}
              to={l.to}
              search={l.search as any}
              className="relative text-sm tracking-wide text-foreground/80 hover:text-primary transition-colors after:absolute after:left-0 after:-bottom-1.5 after:h-px after:w-0 after:bg-primary after:transition-all hover:after:w-full"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button className="p-2.5 rounded-full hover:bg-sakura/30 transition-colors" aria-label="Search">
            <Search className="w-5 h-5 text-foreground/80" />
          </button>
          <Link
            to="/wishlist"
            className="relative p-2.5 rounded-full hover:bg-sakura/30 transition-colors"
            aria-label="Wishlist"
          >
            <Heart className="w-5 h-5 text-foreground/80" />
            {wishlist.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-primary text-primary-foreground text-[10px] font-semibold rounded-full w-5 h-5 flex items-center justify-center">
                {wishlist.length}
              </span>
            )}
          </Link>

          <Link
            to="/cart"
            className={`relative p-2.5 rounded-full hover:bg-sakura/30 transition-colors ${cartShake ? "animate-cart-shake" : ""}`}
            aria-label="Cart"
          >
            <ShoppingBag className="w-5 h-5 text-foreground/80" />
            {cartCount > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-0.5 -right-0.5 bg-primary text-primary-foreground text-[10px] font-semibold rounded-full w-5 h-5 flex items-center justify-center"
              >
                {cartCount}
              </motion.span>
            )}
          </Link>
          <div className="relative" data-user-menu>
            <button
              onClick={() => (user ? setUserMenu((v) => !v) : router.navigate({ to: "/login" }))}
              className="p-2.5 rounded-full hover:bg-sakura/30 transition-colors flex items-center gap-2"
              aria-label="Account"
            >
              <UserIcon className="w-5 h-5 text-foreground/80" />
              {user && (
                <span className="hidden lg:inline text-xs text-foreground/70">
                  {user.role === "Admin" ? "Admin" : user.email.split("@")[0]}
                </span>
              )}
            </button>
            <AnimatePresence>
              {userMenu && user && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="absolute right-0 mt-2 w-60 rounded-xl bg-card border border-border shadow-petal p-2"
                >
                  <div className="flex items-center gap-3 px-3 py-2.5 border-b border-border/60 mb-1">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary text-sm font-semibold">
                      {(user.fullName || user.email || "?").trim().charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {user.fullName || user.email.split("@")[0]}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                      <span
                        className={`mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${
                          user.role === "Admin"
                            ? "bg-gold/20 text-gold"
                            : "bg-primary/15 text-primary"
                        }`}
                      >
                        {user.role === "Admin" ? "Admin" : "Customer"}
                      </span>
                    </div>
                  </div>

                  {user.role === "Admin" && (
                    <Link
                      to="/admin"
                      onClick={() => setUserMenu(false)}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-lg hover:bg-blush transition-colors"
                    >
                      <LayoutDashboard className="w-4 h-4" />
                      Admin Dashboard
                    </Link>
                  )}
                  <Link
                    to="/wishlist"
                    onClick={() => setUserMenu(false)}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-lg hover:bg-blush transition-colors"
                  >
                    <Heart className="w-4 h-4" />
                    My Wishlist
                  </Link>
                  <Link
                    to="/recently-viewed"
                    onClick={() => setUserMenu(false)}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-lg hover:bg-blush transition-colors"
                  >
                    <Clock className="w-4 h-4" />
                    Recently Viewed
                  </Link>
                  <Link
                    to="/compare"
                    onClick={() => setUserMenu(false)}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-lg hover:bg-blush transition-colors"
                  >
                    <Scale className="w-4 h-4" />
                    Compare{compare.length ? ` (${compare.length})` : ""}
                  </Link>

                  <button
                    onClick={() => {
                      logout();
                      setUserMenu(false);
                      router.navigate({ to: "/" });
                    }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-lg hover:bg-blush transition-colors text-left"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign out
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <button
            className="md:hidden p-2.5 rounded-full hover:bg-sakura/30"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Menu"
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="md:hidden overflow-hidden bg-background/95 backdrop-blur-xl border-t border-border"
          >
            <div className="px-6 py-4 flex flex-col gap-3">
              <Link to="/" onClick={() => setMenuOpen(false)}>Home</Link>
              <Link to="/shop" search={{ category: "Clothing" } as any} onClick={() => setMenuOpen(false)}>
                Shop Clothing
              </Link>
              <Link to="/shop" search={{ category: "Accessories" } as any} onClick={() => setMenuOpen(false)}>
                Shop Accessories
              </Link>
              <Link to="/wishlist" onClick={() => setMenuOpen(false)}>Wishlist</Link>
              <Link to="/recently-viewed" onClick={() => setMenuOpen(false)}>Recently Viewed</Link>
              <Link to="/compare" onClick={() => setMenuOpen(false)}>Compare</Link>
              {!user ? (
                <Link to="/login" onClick={() => setMenuOpen(false)}>Sign in</Link>
              ) : (
                <div className="mt-1 border-t border-border/60 pt-3 flex flex-col gap-3">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="truncate">{user.fullName || user.email}</span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                        user.role === "Admin" ? "bg-gold/20 text-gold" : "bg-primary/15 text-primary"
                      }`}
                    >
                      {user.role === "Admin" ? "Admin" : "Customer"}
                    </span>
                  </div>
                  {user.role === "Admin" && (
                    <Link to="/admin" onClick={() => setMenuOpen(false)}>Admin Dashboard</Link>
                  )}
                  <button
                    className="flex items-center gap-2 text-left text-sm"
                    onClick={() => {
                      logout();
                      setMenuOpen(false);
                      router.navigate({ to: "/" });
                    }}
                  >
                    <LogOut className="w-4 h-4" />
                    Sign out
                  </button>
                </div>
              )}


            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
