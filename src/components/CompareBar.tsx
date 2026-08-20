import { AnimatePresence, motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { Scale, X } from "lucide-react";
import { useShoppingLists } from "@/lib/shopping-lists";
import { useProductsByIds } from "@/hooks/useProductsByIds";
import { thumbImageUrl } from "@/lib/zari/image-url";

/**
 * Floating compare tray. Shows the current selection (max 4) with a thumbnail each,
 * a clear-all control and a link to the compare page. Mobile-first: the thumbnails
 * scroll horizontally instead of squeezing.
 */
export function CompareBar() {
  const { compare, removeFromCompare, clearCompare, compareLimit } = useShoppingLists();
  const { items } = useProductsByIds(compare);

  return (
    <AnimatePresence>
      {compare.length > 0 && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="fixed bottom-0 inset-x-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur-xl shadow-petal"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 py-3 flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground shrink-0">
              <Scale className="w-4 h-4 text-primary" />
              Compare
            </div>
            <div className="flex-1 flex gap-2 overflow-x-auto no-scrollbar">
              {items.map(({ id, product }) => (
                <div
                  key={id}
                  className="relative shrink-0 w-14 h-14 rounded-xl overflow-hidden bg-blush border border-border/60"
                >
                  {product?.image ? (
                    <img
                      src={useSizedSrc(product.image, { width: 120, quality: 65, ladder: [160, 240, 320] })}
                      alt={product.name}
                      width={120}
                      height={120}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="absolute inset-0 flex items-center justify-center text-[10px] text-muted-foreground text-center px-1">
                      N/A
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeFromCompare(id)}
                    aria-label="Remove from comparison"
                    className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-background/90 flex items-center justify-center"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {Array.from({ length: Math.max(0, compareLimit - compare.length) }).map((_, i) => (
                <div
                  key={`slot-${i}`}
                  className="shrink-0 w-14 h-14 rounded-xl border border-dashed border-border/70"
                />
              ))}
            </div>
            <button
              type="button"
              onClick={clearCompare}
              className="hidden sm:inline text-xs text-muted-foreground hover:text-primary transition-colors shrink-0"
            >
              Clear
            </button>
            <Link
              to="/compare"
              className="shrink-0 px-4 sm:px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-medium shadow-soft hover:shadow-petal transition-all"
            >
              Compare ({compare.length})
            </Link>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
