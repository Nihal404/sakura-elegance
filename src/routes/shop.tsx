import { createFileRoute } from "@tanstack/react-router";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { Loader2, Search, SlidersHorizontal, Grid2X2, Grid3X3, Filter } from "lucide-react";
import type { Category } from "@/lib/store";
import { ProductCard } from "@/components/ProductCard";
import { LazyMount } from "@/components/LazyMount";
import { ProductGridSkeleton } from "@/components/ProductCardSkeleton";
import { useNearViewport, useProductFeed } from "@/hooks/useProductFeed";
import { z } from "zod";
import { useState } from "react";

const searchSchema = z.object({
  category: z.enum(["Clothing", "Accessories"]).optional(),
  q: z.string().optional(),
});

export const Route = createFileRoute("/shop")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Shop Collection — Zari Boutique" },
      {
        name: "description",
        content:
          "Browse Zari Boutique's clothing and accessories — silks, chiffons, rose gold jewellery and more.",
      },
      { property: "og:title", content: "Shop Collection — Zari Boutique" },
      {
        property: "og:description",
        content: "Browse elegant clothing and accessories at Zari Boutique.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://zaris-elegance.lovable.app/shop" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://zaris-elegance.lovable.app/shop" }],
  }),
  component: Shop,
});

function Shop() {
  const { category, q } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [searchInput, setSearchInput] = useState(q ?? "");
  const [gridCols, setGridCols] = useState<3 | 4>(4);

  const {
    items: filtered,
    loading: productsLoading,
    loadingMore,
    hasMore,
    error,
    loadMore,
  } = useProductFeed({ category: category ?? null, search: q ?? null });
  const sentinelRef = useNearViewport(loadMore, hasMore && !loadingMore);
  const tabs: (Category | undefined)[] = [undefined, "Clothing", "Accessories"];

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate({ search: { category, q: searchInput || undefined } as any });
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      {/* Header Banner */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="glass-panel rounded-3xl p-6 sm:p-10 mb-8 text-center relative overflow-hidden bg-gradient-to-r from-sakura/20 via-background to-blush/30 border border-primary/20 shadow-soft"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary mb-2">
          The Sakura Catalogue
        </p>
        <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground">
          {category ? `${category} Edit` : "All Collections"}
        </h1>
        <p className="mt-3 text-muted-foreground text-sm sm:text-base max-w-xl mx-auto font-sans">
          Thoughtfully curated silk silhouettes, chiffons, and rose gold pearl jewellery.
        </p>
      </motion.div>

      {/* Main Desktop Grid Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Sticky Desktop Filter Sidebar */}
        <aside className="lg:col-span-3 glass-panel rounded-2xl p-5 space-y-6 sticky top-24 border border-border/70 shadow-sm">
          <div className="flex items-center gap-2 pb-3 border-b border-border/60">
            <Filter className="w-4 h-4 text-primary" />
            <h2 className="font-serif text-lg font-semibold text-foreground">Filters & Search</h2>
          </div>

          {/* Search Box */}
          <form onSubmit={handleSearchSubmit} className="relative">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search items..."
              className="w-full pl-9 pr-4 py-2 rounded-xl text-sm bg-background/80 border border-input focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
            />
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
          </form>

          {/* Category Selectors */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Category
            </p>
            <div className="flex flex-col gap-1.5">
              {tabs.map((t) => {
                const active = category === t;
                const label = t ?? "All Products";
                return (
                  <button
                    key={label}
                    onClick={() => navigate({ search: { category: t, q } as any })}
                    className={`flex items-center justify-between px-3.5 py-2 rounded-xl text-sm font-medium transition-all ${
                      active
                        ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                        : "hover:bg-sakura/20 text-foreground/80"
                    }`}
                  >
                    <span>{label}</span>
                    {active && <span className="w-1.5 h-1.5 rounded-full bg-gold" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Clear Filters Button */}
          {(category || q) && (
            <button
              onClick={() => {
                setSearchInput("");
                navigate({ search: {} as any });
              }}
              className="w-full text-center text-xs font-medium text-destructive hover:underline py-1"
            >
              Reset Filters
            </button>
          )}
        </aside>

        {/* Right Column: Main Product Grid & Controls */}
        <main className="lg:col-span-9 space-y-6">
          {/* Top Control Bar */}
          <div className="glass-panel rounded-2xl px-5 py-3 flex flex-wrap items-center justify-between gap-4 border border-border/60">
            <div className="text-xs text-muted-foreground">
              Showing <span className="font-semibold text-foreground">{filtered.length}</span> items
              {category && (
                <span>
                  {" "}
                  in <strong className="text-primary">{category}</strong>
                </span>
              )}
            </div>

            {/* PC Grid Density View Switcher */}
            <div className="hidden sm:flex items-center gap-1.5 bg-background/60 p-1 rounded-xl border border-border/40">
              <button
                onClick={() => setGridCols(3)}
                className={`p-1.5 rounded-lg text-xs flex items-center gap-1 transition-colors ${
                  gridCols === 3
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="3 Columns"
              >
                <Grid2X2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setGridCols(4)}
                className={`p-1.5 rounded-lg text-xs flex items-center gap-1 transition-colors ${
                  gridCols === 4
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="4 Columns"
              >
                <Grid3X3 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Products Grid */}
          <AnimatePresence mode="wait" initial={false}>
            {productsLoading && filtered.length === 0 ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <ProductGridSkeleton count={8} />
              </motion.div>
            ) : filtered.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="text-center glass-panel rounded-3xl py-20 px-6 space-y-3"
              >
                <p className="font-serif text-xl font-semibold">No items match your selection</p>
                <p className="text-sm text-muted-foreground">
                  Try clearing your search query or switching categories.
                </p>
                <button
                  onClick={() => navigate({ search: {} as any })}
                  className="mt-2 inline-flex items-center px-5 py-2 rounded-full bg-primary text-primary-foreground text-xs font-semibold"
                >
                  View All Products
                </button>
              </motion.div>
            ) : (
              <motion.div
                key={category ?? "all"}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.4 }}
                className={`grid grid-cols-2 ${
                  gridCols === 3 ? "lg:grid-cols-3 gap-6" : "lg:grid-cols-4 gap-5"
                }`}
              >
                {filtered.map((p, i) => (
                  <LazyMount key={p.id}>
                    <ProductCard product={p} index={i} priority={i < 4} />
                  </LazyMount>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {error && <p className="mt-8 text-center text-sm text-destructive">{error}</p>}

          {/* Infinite Scroll Sentinel */}
          {hasMore && (
            <div ref={sentinelRef} className="mt-10">
              {loadingMore ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : (
                <ProductGridSkeleton count={4} />
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
