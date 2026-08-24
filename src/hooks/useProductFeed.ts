import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchProductPage,
  PRODUCT_PAGE_SIZE,
  type Category,
  type Product,
  type ProductCursor,
} from "@/lib/zari/products";
import { describeError } from "@/lib/zari/supabase";
import { imageBudget } from "@/lib/zari/image-cache";
import { warmImages } from "@/lib/zari/image-store";
import { CARD_WIDTHS, signedVariantUrl } from "@/lib/zari/image-url";

/**
 * Background preload for a handful of upcoming cards: resolve each right-sized (signed)
 * variant, then let the persistent cache store the bytes. Runs after the visible page has
 * been handed to React, is capped to a small window, and stops itself once the ~50 MB
 * cache target is close.
 */
async function warmProductCards(products: readonly Product[]) {
  if (typeof window === "undefined") return;
  // Let the visible cards win the network first.
  await new Promise((resolve) => setTimeout(resolve, 600));
  if (!imageBudget.canPreload()) return;
  const spec = { width: 400, quality: 70, ladder: CARD_WIDTHS };
  const urls: string[] = [];
  for (const p of products) {
    if (!p.image) continue;
    try {
      urls.push(await signedVariantUrl(p.image, spec));
    } catch {
      /* skip: the card itself will retry when it mounts */
    }
  }
  await warmImages(urls);
}

interface FeedOptions {
  category?: Category | null;
  search?: string | null;
  pageSize?: number;
}

/**
 * Keyset-paginated product feed for the shop grid and admin inventory.
 *
 * Only the loaded pages live in this hook's state (never the whole catalogue in global
 * state). Rapid scrolling cannot fire duplicate requests: a single in-flight guard plus
 * an AbortController per filter change drop stale responses.
 */
export function useProductFeed({
  category = null,
  search = null,
  pageSize = PRODUCT_PAGE_SIZE,
}: FeedOptions = {}) {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cursorRef = useRef<ProductCursor | null>(null);
  const inFlight = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const requestId = useRef(0);

  const load = useCallback(
    async (mode: "reset" | "more") => {
      if (inFlight.current) return;
      inFlight.current = true;
      const id = ++requestId.current;
      if (mode === "reset") {
        abortRef.current?.abort();
        abortRef.current = new AbortController();
        cursorRef.current = null;
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      try {
        const page = await fetchProductPage({
          cursor: mode === "more" ? cursorRef.current : null,
          category,
          search,
          limit: pageSize,
          signal: abortRef.current?.signal,
        });
        if (id !== requestId.current) return; // stale response — ignore
        cursorRef.current = page.cursor;
        setHasMore(page.hasMore);
        setError(null);
        setItems((prev) => {
          if (mode === "reset") return page.items;
          const seen = new Set(prev.map((p) => p.id));
          return [...prev, ...page.items.filter((p) => !seen.has(p.id))];
        });
        // Warm a small window only (never the whole catalogue): sign the card-sized
        // variants for the next few products and put them in the persistent cache.
        void warmProductCards(page.items.slice(0, 8));
      } catch (err) {
        if ((err as { name?: string })?.name === "AbortError") return;
        if (id === requestId.current)
          setError(describeError(err, "Could not load the collection."));
      } finally {
        inFlight.current = false;
        if (id === requestId.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [category, search, pageSize],
  );

  useEffect(() => {
    void load("reset");
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, search, pageSize]);

  const loadMore = useCallback(() => {
    if (!hasMore || inFlight.current) return;
    void load("more");
  }, [hasMore, load]);

  const refresh = useCallback(() => {
    void load("reset");
  }, [load]);

  return { items, loading, loadingMore, hasMore, error, loadMore, refresh };
}

/** Fires `onHit` when the returned ref enters a generous bottom margin. */
export function useNearViewport(onHit: () => void, enabled: boolean) {
  const ref = useRef<HTMLDivElement | null>(null);
  const handler = useRef(onHit);
  handler.current = onHit;

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) handler.current();
      },
      { rootMargin: "600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [enabled]);

  return ref;
}
