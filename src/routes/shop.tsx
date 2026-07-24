import { createFileRoute } from "@tanstack/react-router";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { useStore, type Category } from "@/lib/store";
import { ProductCard } from "@/components/ProductCard";
import { ProductGridSkeleton } from "@/components/ProductCardSkeleton";
import { z } from "zod";

const searchSchema = z.object({
  category: z.enum(["Clothing", "Accessories"]).optional(),
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
    ],
  }),
  component: Shop,
});

function Shop() {
  const { category } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { products, productsLoading } = useStore();

  const filtered = category ? products.filter((p) => p.category === category) : products;
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
            layout
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="grid grid-cols-2 lg:grid-cols-4 gap-5"
          >
            <AnimatePresence mode="popLayout">
              {filtered.map((p, i) => (
                <motion.div
                  key={p.id}
                  layout
                  initial={{ opacity: 0, y: 16, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -12, scale: 0.96 }}
                  transition={{
                    duration: 0.35,
                    ease: [0.22, 1, 0.36, 1],
                    delay: i * 0.03,
                  }}
                >
                  <ProductCard product={p} index={i} />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
