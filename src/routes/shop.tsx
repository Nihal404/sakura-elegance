import { createFileRoute } from "@tanstack/react-router";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { Loader2 } from "lucide-react";
import type { Category } from "@/lib/store";
import { ProductCard } from "@/components/ProductCard";
import { LazyMount } from "@/components/LazyMount";
import { ProductGridSkeleton } from "@/components/ProductCardSkeleton";
import { useNearViewport, useProductFeed } from "@/hooks/useProductFeed";
import { z } from "zod";

const searchSchema = z.object({
  category: z.enum(["Clothing", "Accessories"]).optional(),
  q: z.string().optional(),
});

export const Route = createFileRoute("/shop")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Shop — Zari Boutique" },
      {
        name: "description",
        content: "Browse Zari Boutique's clothing and accessories — silks, chiffons, rose gold jewellery and more.",
      },
      { property: "og:title", content: "Shop — Zari Boutique" },
      { property: "og:description", content: "Browse elegant clothing and accessories at Zari Boutique." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://zaris-elegance.lovable.app/shop" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://zaris-elegance.lovable.app/shop" }],
  }),
  component: Shop,
});

function Shop() {
  const { category } = Route.useSearch();
  const navigate = Route.useNavigate();
  // Server-side filtering + keyset pagination: 24 rows per request, never the whole
  // catalogue, and the category is part of the query rather than a client-side filter.
  const { items: filtered, loading: productsLoading, loadingMore, hasMore, error, loadMore } =
    useProductFeed({ category: category ?? null });
  const sentinelRef = useNearViewport(loadMore, hasMore && !loadingMore);
  const tabs: (Category | undefined)[] = [undefined, "Clothing", "Accessories"];

  return (
    <div className="mx-auto max-w-7xl px-6 lg:px-10 py-14 md:py-20">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center mb-12"
      >
        <p className="text-xs uppercase tracking-[0.3em] text-primary mb-3">The Collection</p>
        <h1 className="font-serif text-5xl md:text-6xl relative inline-block overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={category ?? "all"}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="inline-block"
            >
              {category ?? "Shop All"}
            </motion.span>
          </AnimatePresence>
        </h1>
        <p className="mt-4 text-muted-foreground max-w-lg mx-auto">
          Every piece is thoughtfully curated. Every silhouette, a whisper of spring.
        </p>
      </motion.div>

      <LayoutGroup>
        <div className="flex justify-center gap-2 mb-12 flex-wrap">
          {tabs.map((t) => {
            const active = category === t;
            const label = t ?? "All";
            return (
              <motion.button
                key={label}
                onClick={() => navigate({ search: { category: t } as any })}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.96 }}
                className={`relative px-6 py-2.5 rounded-full text-sm tracking-wide transition-colors ${
                  active
                    ? "text-primary-foreground"
                    : "bg-blush text-foreground/80 hover:bg-sakura/60"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="shop-tab-pill"
                    className="absolute inset-0 bg-primary rounded-full shadow-soft"
                    transition={{ type: "spring", damping: 24, stiffness: 260 }}
                  />
                )}
                <span className="relative z-10">{label}</span>
              </motion.button>
            );
          })}
        </div>
      </LayoutGroup>

      <h2 className="font-serif text-2xl md:text-3xl mt-12 mb-6">
        {category ? `${category} Collection` : "Our Collection"}
      </h2>

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
          <motion.p
            key="empty"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="text-center text-muted-foreground py-20"
          >
            No products yet — check back soon.
          </motion.p>
        ) : (
          <motion.div
            key={category ?? "all"}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="grid grid-cols-2 lg:grid-cols-4 gap-5"
          >
            {filtered.map((p, i) => (
              <LazyMount key={p.id}>
                <ProductCard product={p} index={i} priority={i < 4} />
              </LazyMount>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <p className="mt-8 text-center text-sm text-destructive">{error}</p>
      )}

      {/* Infinite scroll: the next batch is requested only as the user nears the end. */}
      {hasMore && (
        <div ref={sentinelRef} className="mt-10">
          {loadingMore ? (
            <div className="flex justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          ) : (
            <ProductGridSkeleton count={4} />
          )}
        </div>
      )}
    </div>
  );
}
