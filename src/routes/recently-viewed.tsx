import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Clock, Loader2 } from "lucide-react";
import { useShoppingLists } from "@/lib/shopping-lists";
import { useProductsByIds } from "@/hooks/useProductsByIds";
import { ProductCard } from "@/components/ProductCard";

export const Route = createFileRoute("/recently-viewed")({
  head: () => ({
    meta: [
      { title: "Recently Viewed — Zari Boutique" },
      {
        name: "description",
        content:
          "Pick up where you left off: the last Zari Boutique clothing and accessories you looked at, newest first.",
      },
      { property: "og:title", content: "Recently Viewed — Zari Boutique" },
      {
        property: "og:description",
        content: "The last Zari Boutique pieces you looked at, newest first.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RecentlyViewedPage,
});

function RecentlyViewedPage() {
  const { recent, hydrated } = useShoppingLists();
  const ids = recent.map((r) => r.id);
  const { items, loading } = useProductsByIds(ids);
  const available = items.filter((i) => i.product);

  return (
    <div className="mx-auto max-w-7xl px-6 lg:px-10 py-12 lg:py-16">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-primary">
          <Clock className="w-3.5 h-3.5" />
          Your trail
        </span>
        <h1 className="font-serif text-4xl lg:text-5xl mt-3">Recently Viewed</h1>
        <p className="mt-3 text-muted-foreground">
          The last {recent.length || ""} pieces you opened, newest first.
        </p>
      </motion.div>

      <div className="mt-10">
        {!hydrated || (loading && !available.length) ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : available.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border/70 bg-card/60 px-6 py-16 text-center">
            <div className="mx-auto w-14 h-14 rounded-full bg-blush flex items-center justify-center">
              <Clock className="w-6 h-6 text-primary" />
            </div>
            <h2 className="mt-5 font-serif text-2xl">No history yet</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Open a piece and it will appear here for easy return.
            </p>
            <Link
              to="/shop"
              className="mt-6 inline-flex px-6 py-3 rounded-full bg-primary text-primary-foreground shadow-soft hover:shadow-petal transition-all"
            >
              Start browsing
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
            {available.map(({ id, product }, i) => (
              <ProductCard key={id} product={product!} index={i} priority={i < 4} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
