/**
 * Storage layer for Wishlist, Recently Viewed and Compare.
 *
 * - Compare is always local-only (localStorage) — it is a transient shopping aid.
 * - Wishlist and Recently Viewed are local for guests and mirrored to Supabase for
 *   signed-in shoppers, so they follow the account across devices.
 * - The server tables are created by supabase/zari-project.sql. If they are not present
 *   yet (or RLS blocks the row), every helper degrades silently to local-only instead of
 *   breaking the storefront.
 */
import { supabase } from "./supabase";

/** Untyped view of the client: these tables are additive and not in database.types.ts. */
const db = supabase as unknown as {
  from: (table: string) => any;
};

export const WISHLIST_KEY = "zari-wishlist";
export const RECENT_KEY = "zari-recently-viewed";
export const COMPARE_KEY = "zari-compare";

export const RECENT_LIMIT = 20;
export const COMPARE_LIMIT = 4;

export interface RecentEntry {
  id: string;
  viewedAt: string;
}

/* --------------------------------------------------------------- local storage */

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota or private mode — feature still works for this session */
  }
}

export const localWishlist = {
  get: () => read<string[]>(WISHLIST_KEY, []),
  set: (ids: string[]) => write(WISHLIST_KEY, ids),
  clear: () => {
    if (typeof window !== "undefined") window.localStorage.removeItem(WISHLIST_KEY);
  },
};

export const localRecent = {
  get: () => read<RecentEntry[]>(RECENT_KEY, []).filter((e) => e && typeof e.id === "string"),
  set: (entries: RecentEntry[]) => write(RECENT_KEY, entries.slice(0, RECENT_LIMIT)),
};

export const localCompare = {
  get: () => read<string[]>(COMPARE_KEY, []).slice(0, COMPARE_LIMIT),
  set: (ids: string[]) => write(COMPARE_KEY, ids.slice(0, COMPARE_LIMIT)),
};

/** Newest-first, de-duplicated by product id. */
export function mergeRecent(entries: RecentEntry[]): RecentEntry[] {
  const seen = new Set<string>();
  const out: RecentEntry[] = [];
  for (const e of [...entries].sort((a, b) => b.viewedAt.localeCompare(a.viewedAt))) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    out.push(e);
    if (out.length >= RECENT_LIMIT) break;
  }
  return out;
}

/* --------------------------------------------------------------------- server */

/** True when the backend tables exist; flipped off on the first "missing table" error. */
let serverListsAvailable = true;
export const hasServerLists = () => serverListsAvailable;

function noteError(err: unknown) {
  const code = (err as { code?: string } | null)?.code;
  const message = ((err as { message?: string } | null)?.message ?? "").toLowerCase();
  if (code === "42P01" || message.includes("does not exist") || message.includes("schema cache")) {
    serverListsAvailable = false;
  }
}

export async function fetchServerWishlist(userId: string): Promise<string[] | null> {
  if (!serverListsAvailable) return null;
  const { data, error } = await db
    .from("wishlist_items")
    .select("product_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) {
    noteError(error);
    return null;
  }
  return ((data ?? []) as { product_id: string }[]).map((r) => r.product_id);
}

export async function addServerWishlist(userId: string, productIds: string[]) {
  if (!serverListsAvailable || !productIds.length) return;
  const { error } = await db.from("wishlist_items").upsert(
    productIds.map((product_id) => ({ user_id: userId, product_id })),
    { onConflict: "user_id,product_id", ignoreDuplicates: true },
  );
  if (error) noteError(error);
}

export async function removeServerWishlist(userId: string, productId: string) {
  if (!serverListsAvailable) return;
  const { error } = await db
    .from("wishlist_items")
    .delete()
    .eq("user_id", userId)
    .eq("product_id", productId);
  if (error) noteError(error);
}

export async function fetchServerRecent(userId: string): Promise<RecentEntry[] | null> {
  if (!serverListsAvailable) return null;
  const { data, error } = await db
    .from("recently_viewed")
    .select("product_id, viewed_at")
    .eq("user_id", userId)
    .order("viewed_at", { ascending: false })
    .limit(RECENT_LIMIT);
  if (error) {
    noteError(error);
    return null;
  }
  return ((data ?? []) as { product_id: string; viewed_at: string }[]).map((r) => ({
    id: r.product_id,
    viewedAt: r.viewed_at,
  }));
}

/**
 * One upsert per product view. The caller throttles per session, so opening the same
 * product repeatedly does not generate a stream of writes.
 */
export async function recordServerView(userId: string, productId: string, viewedAt: string) {
  if (!serverListsAvailable) return;
  const { error } = await db
    .from("recently_viewed")
    .upsert(
      { user_id: userId, product_id: productId, viewed_at: viewedAt },
      { onConflict: "user_id,product_id" },
    );
  if (error) noteError(error);
}
