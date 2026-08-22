import { Link, useRouter } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { Search, User as UserIcon, LogOut, LayoutDashboard, Heart, Clock, Scale } from "lucide-react";
import { useShoppingLists } from "@/lib/shopping-lists";
import { SearchModal } from "@/components/SearchModal";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";

export function Navbar() {
  const { user, logout } = useStore();
  const { compare } = useShoppingLists();

  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
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
      className="fixed top-3 inset-x-0 z-50 px-4"
    >
      <div
        className={`glass-panel mx-auto flex h-16 max-w-5xl items-center justify-between rounded-2xl px-4 sm:px-6 transition-shadow duration-500 ${
          scrolled ? "shadow-petal" : ""
        }`}
      >
        <Link to="/" className="flex items-center gap-1.5" data-press>
          <span className="font-zari font-bold text-[26px] md:text-[32px] tracking-normal text-gold drop-shadow-sm">
            Zari
          </span>
          <span className="font-times uppercase text-[15px] md:text-[18px] tracking-[0.18em] text-foreground">
            Boutique
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSearchOpen(true)}
            className="glass-btn flex h-11 w-11 items-center justify-center rounded-full"
            aria-label="Search"
            data-press
          >
            <Search className="h-5 w-5 text-foreground/80" />
          </button>

          <div className="relative" data-user-menu>
            <button
              onClick={() => (user ? setUserMenu((v) => !v) : router.navigate({ to: "/login" }))}
              className="glass-btn flex h-11 items-center gap-2 rounded-full px-3"
              aria-label="Profile"
            >
              <UserIcon className="h-5 w-5 text-foreground/80" />
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
                  className="glass-panel absolute right-0 mt-3 w-60 rounded-2xl p-2 shadow-petal"
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
        </div>
      </div>
    </motion.header>
  );
}
