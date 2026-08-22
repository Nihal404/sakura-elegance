import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Search, ShoppingBag, X } from "lucide-react";
import { SizedImg } from "@/components/SizedImg";
import { useStore, type Product as StoreProduct } from "@/lib/store";
import { fetchProductPage, type Product } from "@/lib/zari/products";
import { playAddToCartSound } from "@/lib/zari/sound";

/**
 * Frosted-glass quick search overlay: debounced catalogue search with
 * inline add-to-cart on each result.
 */
export function SearchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addToCart } = useStore();
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [added, setAdded] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 120);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      setTerm("");
      setResults([]);
    }
  }, [open]);

  useEffect(() => {
    const q = term.trim();
    if (!open || q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(() => {
      fetchProductPage({ search: q, limit: 6, signal: controller.signal })
        .then((page) => setResults(page.items))
        .catch(() => {
          /* aborted or offline — keep last results */
        })
        .finally(() => setLoading(false));
    }, 280);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [term, open]);

  const handleAdd = (p: Product) => {
    addToCart(p as unknown as StoreProduct, 1);
    playAddToCartSound();
    setAdded(p.id);
    setTimeout(() => setAdded((cur) => (cur === p.id ? null : cur)), 1400);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[90] flex items-start justify-center px-4 pt-24 pb-10 bg-foreground/25 backdrop-blur-sm"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label="Search products"
        >
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ type: "spring", damping: 20, stiffness: 240 }}
            onClick={(e) => e.stopPropagation()}
            className="glass-panel w-full max-w-xl rounded-3xl p-4 sm:p-5 shadow-petal"
          >
            <div className="flex items-center gap-3">
              <Search className="h-5 w-5 shrink-0 text-primary" />
              <input
                ref={inputRef}
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Search silks, jewellery, charms…"
                className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
              />
              <button
                onClick={onClose}
                aria-label="Close search"
                className="glass-btn flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 max-h-[55vh] overflow-y-auto">
              {loading && results.length === 0 ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : term.trim().length < 2 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Type at least two letters to see quick results.
                </p>
              ) : results.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No pieces match “{term.trim()}”.
                </p>
              ) : (
                <ul className="space-y-2">
                  {results.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center gap-3 rounded-2xl bg-background/60 p-2 pr-3"
                    >
                      <Link
                        to="/product/$id"
                        params={{ id: p.id }}
                        onClick={onClose}
                        className="flex min-w-0 flex-1 items-center gap-3"
                      >
                        <SizedImg
                          raw={p.image}
                          spec={{ width: 160, quality: 62, ladder: [160, 240, 320] }}
                          alt={p.name}
                          loading="lazy"
                          decoding="async"
                          className="h-14 w-12 shrink-0 rounded-xl object-cover"
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{p.name}</span>
                          <span className="block text-xs text-muted-foreground">
                            {p.category} · ₹{p.price.toFixed(0)}
                          </span>
                        </span>
                      </Link>
                      <button
                        onClick={() => handleAdd(p)}
                        data-press
                        aria-label={`Add ${p.name} to bag`}
                        className="glass-btn flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-medium"
                      >
                        <ShoppingBag className="h-4 w-4" />
                        {added === p.id ? "Added" : "Add"}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {term.trim().length >= 2 && (
              <Link
                to="/shop"
                search={{ q: term.trim() } as never}
                onClick={onClose}
                className="mt-3 block rounded-full bg-primary/90 py-2.5 text-center text-sm font-medium text-primary-foreground"
              >
                See all results in Shop
              </Link>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
