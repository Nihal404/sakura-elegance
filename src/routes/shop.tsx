import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useStore, type Category } from "@/lib/store";
import { ProductCard } from "@/components/ProductCard";
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
  const { products } = useStore();

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
        <h1 className="font-serif text-5xl md:text-6xl">
          {category ?? "Shop All"}
        </h1>
        <p className="mt-4 text-muted-foreground max-w-lg mx-auto">
          Every piece is thoughtfully curated. Every silhouette, a whisper of spring.
        </p>
      </motion.div>

      <div className="flex justify-center gap-2 mb-12 flex-wrap">
        {tabs.map((t) => {
          const active = category === t;
          const label = t ?? "All";
          return (
            <button
              key={label}
              onClick={() => navigate({ search: { category: t } as any })}
              className={`px-6 py-2.5 rounded-full text-sm tracking-wide transition-all ${
                active
                  ? "bg-primary text-primary-foreground shadow-soft"
                  : "bg-blush text-foreground/80 hover:bg-sakura/60"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-20">No products yet — check back soon.</p>
      ) : (
        <motion.div layout className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          {filtered.map((p, i) => (
            <ProductCard key={p.id} product={p} index={i} />
          ))}
        </motion.div>
      )}
    </div>
  );
}
