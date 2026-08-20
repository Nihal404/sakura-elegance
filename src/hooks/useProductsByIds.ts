import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { fetchProductsByIds, type Product } from "@/lib/zari/products";

/**
 * Resolves a small set of product ids (wishlist / recently viewed / compare) without
 * fetching the catalogue: rows already in the store are reused and only the remainder
 * is fetched, in a single `in (...)` query. Ids with no row (deleted products) are
 * reported back so the UI can show an "unavailable" placeholder.
 */
export function useProductsByIds(ids: readonly string[]) {
  const { products } = useStore();
  const [fetched, setFetched] = useState<Map<string, Product>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resolvedRef = useRef<Set<string>>(new Set());

  const known = useMemo(() => {
    const map = new Map<string, Product>();
    for (const p of products) map.set(p.id, p);
    for (const [id, p] of fetched) map.set(id, p);
    return map;
  }, [products, fetched]);

  const key = ids.join(",");

  useEffect(() => {
    const missing = ids.filter((id) => !known.has(id) && !resolvedRef.current.has(id));
    if (!missing.length) return;
    let active = true;
    setLoading(true);
    void fetchProductsByIds(missing)
      .then((rows) => {
        if (!active) return;
        for (const id of missing) resolvedRef.current.add(id);
        setFetched((prev) => {
          const next = new Map(prev);
          for (const p of rows) next.set(p.id, p);
          return next;
        });
        setError(null);
      })
      .catch(() => {
        if (active) setError("Could not load these pieces. Please try again.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, known]);

  const items = useMemo(
    () => ids.map((id) => ({ id, product: known.get(id) ?? null })),
    [key, known], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const unavailable = useMemo(
    () => items.filter((i) => !i.product && resolvedRef.current.has(i.id)).map((i) => i.id),
    [items],
  );

  return { items, loading, error, unavailable };
}
