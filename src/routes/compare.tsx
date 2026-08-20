import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Scale, ShoppingBag, X } from "lucide-react";
import { useShoppingLists } from "@/lib/shopping-lists";
import { useProductsByIds } from "@/hooks/useProductsByIds";
import { useStore } from "@/lib/store";
import { CARD_WIDTHS } from "@/lib/zari/image-url";
import { SizedImg } from "@/components/SizedImg";
import type { Product } from "@/lib/zari/products";

export const Route = createFileRoute("/compare")({
  head: () => ({
    meta: [
      { title: "Compare Pieces — Zari Boutique" },
      {
        name: "description",
        content:
          "Compare up to four Zari Boutique pieces side by side — price, category, description and highlights — and choose the one that's right for you.",
      },
      { property: "og:title", content: "Compare Pieces — Zari Boutique" },
      {
        property: "og:description",
        content: "Compare up to four Zari Boutique pieces side by side.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ComparePage,
});

interface Row {
  label: string;
  render: (p: Product) => string;
}

const ROWS: Row[] = [
  { label: "Price", render: (p) => `₹${p.price}` },
  { label: "Category", render: (p) => p.category },
  {
    label: "Highlights",
    render: (p) => (p.features.length ? p.features.join(" · ") : "—"),
  },
  { label: "Photos", render: (p) => String(p.mockups.length || 1) },
  {
    label: "Description",
    render: (p) => (p.description?.trim() ? p.description : "—"),
  },
];

function ComparePage() {
  const { compare, removeFromCompare, clearCompare, hydrated, compareLimit } = useShoppingLists();
  const { items, loading } = useProductsByIds(compare);
  const { addToCart, setCartOpen } = useStore();

  const products = items.filter((i) => i.product).map((i) => i.product!);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10 py-12 lg:py-16 pb-32">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-primary">
          <Scale className="w-3.5 h-3.5" />
          Side by side
        </span>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <h1 className="font-serif text-4xl lg:text-5xl">Compare</h1>
          {compare.length > 0 && (
            <button
              onClick={clearCompare}
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              Clear all
            </button>
          )}
        </div>
        <p className="mt-3 text-muted-foreground">
          Up to {compareLimit} pieces. Differences are highlighted in rose.
        </p>
      </motion.div>

      <div className="mt-10">
        {!hydrated || (loading && !products.length) ? (
          <div className="h-64 rounded-3xl bg-sakura-gradient animate-pulse" />
        ) : products.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border/70 bg-card/60 px-6 py-16 text-center">
            <div className="mx-auto w-14 h-14 rounded-full bg-blush flex items-center justify-center">
              <Scale className="w-6 h-6 text-primary" />
            </div>
            <h2 className="mt-5 font-serif text-2xl">Nothing to compare yet</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Use the compare icon on any piece to line it up here.
            </p>
            <Link
              to="/shop"
              className="mt-6 inline-flex px-6 py-3 rounded-full bg-primary text-primary-foreground shadow-soft hover:shadow-petal transition-all"
            >
              Browse the collection
            </Link>
          </div>
        ) : (
          /* Mobile-first: one scrollable track of full-width columns, no cramped grid. */
          <div className="overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
            <div
              className="grid gap-4 justify-start"
              style={{
                gridTemplateColumns: `repeat(${products.length}, minmax(240px, ${
                  products.length > 2 ? "1fr" : "300px"
                }))`,
                minWidth: products.length > 1 ? `${products.length * 244}px` : undefined,
              }}

            >
              {products.map((p) => (
                <div
                  key={p.id}
                  className="rounded-3xl bg-card shadow-soft overflow-hidden flex flex-col"
                >
                  <div className="relative aspect-[3/4] bg-blush">
                    <Link to="/product/$id" params={{ id: p.id }}>
                      <SizedImg
                        raw={p.image}
                        spec={{ width: 400, quality: 70, ladder: CARD_WIDTHS }}
                        alt={p.name}
                        width={400}
                        height={533}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover"
                      />
                    </Link>
                    <button
                      type="button"
                      onClick={() => removeFromCompare(p.id)}
                      aria-label={`Remove ${p.name} from comparison`}
                      className="absolute top-3 right-3 w-8 h-8 rounded-full bg-background/90 backdrop-blur flex items-center justify-center hover:text-primary"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="p-4">
                    <Link to="/product/$id" params={{ id: p.id }}>
                      <h2 className="font-serif text-lg leading-tight hover:text-primary transition-colors">
                        {p.name}
                      </h2>
                    </Link>
                  </div>

                  <dl className="px-4 pb-4 space-y-3">
                    {ROWS.map((row) => {
                      const value = row.render(p);
                      const differs =
                        products.length > 1 &&
                        products.some((other) => other.id !== p.id && row.render(other) !== value);
                      return (
                        <div key={row.label}>
                          <dt className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                            {row.label}
                          </dt>
                          <dd
                            className={`mt-1 text-sm rounded-xl px-3 py-2 ${
                              differs
                                ? "bg-blush text-foreground ring-1 ring-primary/30"
                                : "bg-muted/40 text-foreground/75"
                            }`}
                          >
                            {row.label === "Description" ? (
                              <span className="line-clamp-6">{value}</span>
                            ) : (
                              value
                            )}
                          </dd>
                        </div>
                      );
                    })}
                  </dl>

                  <div className="mt-auto p-4 pt-0">
                    <button
                      onClick={() => {
                        addToCart(p);
                        setCartOpen(true);
                      }}
                      className="w-full py-3 rounded-full bg-primary text-primary-foreground text-sm font-medium shadow-soft hover:shadow-petal transition-all inline-flex items-center justify-center gap-2"
                    >
                      <ShoppingBag className="w-4 h-4" />
                      Add to Cart
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
