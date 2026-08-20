import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useStore } from "@/lib/store";
import {
  COMPARE_LIMIT,
  RECENT_LIMIT,
  addServerWishlist,
  fetchServerRecent,
  fetchServerWishlist,
  localCompare,
  localRecent,
  localWishlist,
  mergeRecent,
  recordServerView,
  removeServerWishlist,
  type RecentEntry,
} from "@/lib/zari/shopping-lists";

interface ShoppingListsValue {
  hydrated: boolean;

  wishlist: string[];
  wishlistLoading: boolean;
  isWishlisted: (id: string) => boolean;
  toggleWishlist: (id: string) => void;
  removeFromWishlist: (id: string) => void;

  recent: RecentEntry[];
  recordView: (id: string) => void;

  compare: string[];
  isComparing: (id: string) => boolean;
  /** Returns false when the 4-product limit is already reached. */
  toggleCompare: (id: string) => boolean;
  removeFromCompare: (id: string) => void;
  clearCompare: () => void;
  compareLimit: number;
}

const Ctx = createContext<ShoppingListsValue | null>(null);

/** Do not re-write the same product's view row more than once every 30 minutes. */
const VIEW_THROTTLE_MS = 30 * 60 * 1000;

export function ShoppingListsProvider({ children }: { children: ReactNode }) {
  const { user } = useStore();
  const [hydrated, setHydrated] = useState(false);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [recent, setRecent] = useState<RecentEntry[]>([]);
  const [compare, setCompare] = useState<string[]>([]);
  const lastViewWrite = useRef<Map<string, number>>(new Map());

  /* --------------------------------------------------- hydrate from localStorage */

  useEffect(() => {
    setWishlist(localWishlist.get());
    setRecent(mergeRecent(localRecent.get()));
    setCompare(localCompare.get());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localCompare.set(compare);
  }, [compare, hydrated]);

  useEffect(() => {
    if (hydrated) localRecent.set(recent);
  }, [recent, hydrated]);

  // Guests keep the wishlist locally; signed-in shoppers keep the server copy
  // authoritative, so we don't shadow it in localStorage.
  useEffect(() => {
    if (hydrated && !user) localWishlist.set(wishlist);
  }, [wishlist, hydrated, user]);

  /* ------------------------------------------------------- sign-in: merge + sync */

  useEffect(() => {
    if (!hydrated) return;
    let active = true;
    if (!user) {
      setWishlist(localWishlist.get());
      setRecent((prev) => mergeRecent([...localRecent.get(), ...prev]));
      lastViewWrite.current = new Map();
      return;
    }
    (async () => {
      setWishlistLoading(true);
      try {
        const pending = localWishlist.get();
        if (pending.length) await addServerWishlist(user.id, pending);
        const server = await fetchServerWishlist(user.id);
        if (!active) return;
        if (server) {
          setWishlist(mergeIds(server, pending));
          localWishlist.clear();
        } else if (pending.length) {
          setWishlist(pending);
        }
        const serverRecent = await fetchServerRecent(user.id);
        if (active && serverRecent) {
          setRecent(mergeRecent([...serverRecent, ...localRecent.get()]));
        }
      } catch {
        /* local lists remain usable */
      } finally {
        if (active) setWishlistLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [user?.id, hydrated]);

  /* ------------------------------------------------------------------- wishlist */

  const toggleWishlist = useCallback(
    (id: string) => {
      setWishlist((prev) => {
        const has = prev.includes(id);
        const next = has ? prev.filter((x) => x !== id) : [id, ...prev];
        if (user) {
          void (has ? removeServerWishlist(user.id, id) : addServerWishlist(user.id, [id]));
        }
        return next;
      });
    },
    [user],
  );

  const removeFromWishlist = useCallback(
    (id: string) => {
      setWishlist((prev) => prev.filter((x) => x !== id));
      if (user) void removeServerWishlist(user.id, id);
    },
    [user],
  );

  const isWishlisted = useCallback((id: string) => wishlist.includes(id), [wishlist]);

  /* ------------------------------------------------------------ recently viewed */

  const recordView = useCallback(
    (id: string) => {
      const viewedAt = new Date().toISOString();
      setRecent((prev) => mergeRecent([{ id, viewedAt }, ...prev]).slice(0, RECENT_LIMIT));
      if (!user) return;
      const last = lastViewWrite.current.get(id) ?? 0;
      if (Date.now() - last < VIEW_THROTTLE_MS) return;
      lastViewWrite.current.set(id, Date.now());
      void recordServerView(user.id, id, viewedAt);
    },
    [user],
  );

  /* -------------------------------------------------------------------- compare */

  const toggleCompare = useCallback((id: string) => {
    let ok = true;
    setCompare((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= COMPARE_LIMIT) {
        ok = false;
        return prev;
      }
      return [...prev, id];
    });
    return ok;
  }, []);

  const removeFromCompare = useCallback(
    (id: string) => setCompare((prev) => prev.filter((x) => x !== id)),
    [],
  );
  const clearCompare = useCallback(() => setCompare([]), []);
  const isComparing = useCallback((id: string) => compare.includes(id), [compare]);

  const value = useMemo<ShoppingListsValue>(
    () => ({
      hydrated,
      wishlist,
      wishlistLoading,
      isWishlisted,
      toggleWishlist,
      removeFromWishlist,
      recent,
      recordView,
      compare,
      isComparing,
      toggleCompare,
      removeFromCompare,
      clearCompare,
      compareLimit: COMPARE_LIMIT,
    }),
    [
      hydrated,
      wishlist,
      wishlistLoading,
      isWishlisted,
      toggleWishlist,
      removeFromWishlist,
      recent,
      recordView,
      compare,
      isComparing,
      toggleCompare,
      removeFromCompare,
      clearCompare,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function mergeIds(a: string[], b: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of [...b, ...a]) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function useShoppingLists() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useShoppingLists must be used within ShoppingListsProvider");
  return ctx;
}
