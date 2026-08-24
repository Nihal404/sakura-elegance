import { Link, useRouter, useLocation } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  User as UserIcon,
  LogOut,
  LayoutDashboard,
  Heart,
  Clock,
  Scale,
  ShoppingBag,
  Sun,
  Moon,
} from "lucide-react";
import { useShoppingLists } from "@/lib/shopping-lists";
import { SearchModal } from "@/components/SearchModal";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";

export function Navbar() {
  const { user, logout, cartCount, theme, toggleTheme } = useStore();
  const { compare, wishlist } = useShoppingLists();

  const router = useRouter();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

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

  const navLinks = [
    { label: "Home", to: "/" },
    { label: "Shop", to: "/shop" },
    { label: "Wishlist", to: "/wishlist" },
    { label: "Compare", to: "/compare" },
  ];

  return (
    <>
      <motion.header
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="fixed top-3 inset-x-0 z-50 px-4 md:px-8"
      >
        <div
          className={`glass-panel mx-auto flex h-16 max-w-7xl items-center justify-between rounded-2xl px-4 sm:px-8 transition-all duration-500 ${
            scrolled ? "shadow-petal bg-background/85 backdrop-blur-md" : ""
          }`}
        >
          {/* Logo & PC Navigation Links */}
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2 group" data-press>
              <span className="font-zari font-bold text-[26px] md:text-[34px] tracking-normal text-gold drop-shadow-sm group-hover:scale-105 transition-transform duration-300">
                Zari
              </span>
              <span className="font-times uppercase text-[14px] md:text-[17px] tracking-[0.2em] text-foreground font-semibold">
                Boutique
              </span>
            </Link>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center gap-6">
              {navLinks.map((link) => {
                const isActive = location.pathname === link.to;
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`relative text-sm font-medium transition-colors duration-300 py-1.5 ${
                      isActive
                        ? "text-primary font-semibold"
                        : "text-foreground/75 hover:text-foreground"
                    }`}
                  >
                    {link.label}
                    {isActive && (
                      <motion.div
                        layoutId="activeNavIndicator"
                        className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-primary"
                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      />
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Quick Action Icons & Profile */}
          <div className="flex items-center gap-2 md:gap-3">
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="glass-btn flex h-10 w-10 md:h-11 md:w-11 items-center justify-center rounded-full hover:bg-sakura/20 transition-colors text-foreground/80"
              aria-label="Toggle Theme"
              title={`Switch to ${theme === "light" ? "Dark" : "Light"} Mode`}
              data-press
            >
              {theme === "dark" ? (
                <Sun className="h-5 w-5 text-gold animate-spin-slow" />
              ) : (
                <Moon className="h-5 w-5 text-primary" />
              )}
            </button>

            {/* Search Trigger */}
            <button
              onClick={() => setSearchOpen(true)}
              className="glass-btn flex h-10 w-10 md:h-11 md:w-11 items-center justify-center rounded-full hover:bg-sakura/20 transition-colors"
              aria-label="Search"
              data-press
            >
              <Search className="h-5 w-5 text-foreground/80" />
            </button>

            {/* Desktop Wishlist Shortcut */}
            <Link
              to="/wishlist"
              className="hidden md:flex glass-btn relative h-11 w-11 items-center justify-center rounded-full hover:bg-sakura/20 transition-colors"
              aria-label="Wishlist"
              data-press
            >
              <Heart className="h-5 w-5 text-foreground/80" />
              {wishlist.length > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground shadow-sm animate-pulse">
                  {wishlist.length}
                </span>
              )}
            </Link>

            {/* Cart Shortcut with Badge */}
            <Link
              to="/cart"
              className="glass-btn relative flex h-10 md:h-11 items-center gap-2 rounded-full px-3 hover:bg-sakura/20 transition-colors"
              aria-label="Shopping Cart"
              data-press
            >
              <ShoppingBag className="h-5 w-5 text-foreground/80" />
              <span className="hidden sm:inline text-xs font-semibold text-foreground/80">
                Cart
              </span>
              {cartCount > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gold text-[11px] font-bold text-background shadow-sm">
                  {cartCount}
                </span>
              )}
            </Link>

            {/* Profile Menu */}
            <div className="relative" data-user-menu>
              <button
                onClick={() => (user ? setUserMenu((v) => !v) : router.navigate({ to: "/login" }))}
                className="glass-btn flex h-10 md:h-11 items-center gap-2 rounded-full px-3 hover:bg-sakura/20 transition-colors"
                aria-label="Profile"
              >
                <UserIcon className="h-5 w-5 text-foreground/80" />
                {user && (
                  <span className="hidden lg:inline text-xs font-medium text-foreground/80 max-w-[100px] truncate">
                    {user.fullName || user.email.split("@")[0]}
                  </span>
                )}
              </button>
              <AnimatePresence>
                {userMenu && user && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="glass-panel absolute right-0 mt-3 w-64 rounded-2xl p-2 shadow-petal bg-background/95 backdrop-blur-xl border border-border/80"
                  >
                    <div className="flex items-center gap-3 px-3 py-2.5 border-b border-border/60 mb-1">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary text-sm font-semibold shadow-inner">
                        {(user.fullName || user.email || "?").trim().charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {user.fullName || user.email.split("@")[0]}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                        <span
                          className={`mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${
                            user.role === "Admin"
                              ? "bg-gold/20 text-gold border border-gold/30"
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
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-lg hover:bg-sakura/20 transition-colors text-foreground font-medium"
                      >
                        <LayoutDashboard className="w-4 h-4 text-gold" />
                        Admin Dashboard
                      </Link>
                    )}
                    <Link
                      to="/wishlist"
                      onClick={() => setUserMenu(false)}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-lg hover:bg-sakura/20 transition-colors text-foreground font-medium"
                    >
                      <Heart className="w-4 h-4 text-primary" />
                      My Wishlist ({wishlist.length})
                    </Link>
                    <Link
                      to="/recently-viewed"
                      onClick={() => setUserMenu(false)}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-lg hover:bg-sakura/20 transition-colors text-foreground font-medium"
                    >
                      <Clock className="w-4 h-4 text-accent" />
                      Recently Viewed
                    </Link>
                    <Link
                      to="/compare"
                      onClick={() => setUserMenu(false)}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-lg hover:bg-sakura/20 transition-colors text-foreground font-medium"
                    >
                      <Scale className="w-4 h-4 text-muted-foreground" />
                      Compare ({compare.length})
                    </Link>

                    <div className="my-1 border-t border-border/40" />

                    <button
                      onClick={() => {
                        logout();
                        setUserMenu(false);
                        router.navigate({ to: "/" });
                      }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-lg hover:bg-destructive/10 text-destructive transition-colors text-left font-medium"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign out
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </motion.header>
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
