import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, Clock } from "lucide-react";
import { useShoppingLists } from "@/lib/shopping-lists";
import { useProductsByIds } from "@/hooks/useProductsByIds";
import { SizedImg } from "@/components/SizedImg";

/**
 * Compact horizontal rail of the pieces the shopper recently opened.
 * Renders nothing until there is at least one resolvable product, so the
 * home page keeps its rhythm for first-time visitors.
 */
export function RecentlyViewedStrip({ limit = 10 }: { limit?: number }) {
  const { recent, hydrated } = useShoppingLists();
  const ids = recent.slice(0, limit).map((r) => r.id);
  const { items } = useProductsByIds(ids);
  const available = items.filter((i) => i.product);

  if (!hydrated || available.length === 0) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-10 mt-8"
      aria-label="Recently viewed"
    >
      <div className="flex items-end justify-between gap-3 mb-4">
        <div>
          <p className="inline-flex items-center gap-1.5 text-[0.65rem] uppercase tracking-[0.2em] text-primary">
            <Clock className="w-3.5 h-3.5" />
            Recently viewed
          </p>
          <h2 className="font-serif text-2xl sm:text-3xl mt-1">Pick up where you left off</h2>
        </div>
        <Link
          to="/recently-viewed"
          className="hidden sm:inline-flex items-center gap-1.5 text-sm text-foreground/70 hover:text-primary transition-colors"
        >
          See all <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      <ul className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-2 snap-x snap-mandatory">
        {available.map(({ id, product }) => (
          <li key={id} className="snap-start shrink-0 w-[136px] sm:w-[160px]">
            <Link
              to="/product/$id"
              params={{ id }}
              data-press
              className="group block rounded-2xl overflow-hidden glass-panel"
            >
              <div className="aspect-[3/4] bg-sakura-gradient overflow-hidden">
                <SizedImg
                  raw={product!.image}
                  spec={{ width: 320, quality: 68, ladder: [200, 320, 480] }}
                  alt={product!.name}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
              </div>
              <div className="p-2.5">
                <p className="truncate text-xs sm:text-sm font-medium">{product!.name}</p>
                <p className="mt-0.5 text-xs text-primary tabular-nums">
                  ₹{product!.price.toFixed(0)}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </motion.section>
  );
}
