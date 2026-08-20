/**
 * Application-level image cache for Zari Boutique.
 *
 * The browser owns its HTTP cache and can evict whenever it likes, which on mobile Chrome
 * means a card image that was already downloaded gets refetched after navigating away and
 * back. This module keeps successfully fetched product images in Cache Storage, hands out
 * blob URLs for them, and enforces a ~50 MB rolling budget with least-recently-used
 * eviction so it can never balloon on a phone. Evicted images are simply refetched the
 * next time they are needed.
 *
 * Everything degrades gracefully: if Cache Storage is unavailable (private mode, old
 * browser, SSR) callers fall back to using the network URL directly on the <img>.
 */

const CACHE_NAME = "zari-product-images-v1";
const META_KEY = "zari.img.cache.meta.v1";
/** Rolling target for cached image bytes. */
export const IMAGE_CACHE_TARGET_BYTES = 50 * 1024 * 1024;
/** Never cache a single monster file; those stream from the network instead. */
const MAX_ENTRY_BYTES = 6 * 1024 * 1024;
/** Evict down to this soft target so we don't thrash right at the ceiling. */
const SOFT_TARGET_BYTES = 45 * 1024 * 1024;

const DEV = import.meta.env.DEV;
/** Dev-only cache diagnostics: hit / miss / store / evict / fail. */
function log(event: string, detail: Record<string, unknown>) {
  if (DEV) console.info(`[zari:image-cache] ${event}`, detail);
}

interface MetaEntry {
  bytes: number;
  lastUsed: number;
}

const meta = new Map<string, MetaEntry>();
let metaLoaded = false;
let cachedBytes = 0;

function loadMeta() {
  if (metaLoaded || typeof localStorage === "undefined") return;
  metaLoaded = true;
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return;
    for (const [url, entry] of Object.entries(JSON.parse(raw) as Record<string, MetaEntry>)) {
      if (entry && typeof entry.bytes === "number") {
        meta.set(url, entry);
        cachedBytes += entry.bytes;
      }
    }
  } catch {
    /* ignore */
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function saveMeta() {
  if (typeof localStorage === "undefined" || saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      localStorage.setItem(META_KEY, JSON.stringify(Object.fromEntries(meta)));
    } catch {
      /* quota: in-memory accounting still applies */
    }
  }, 500);
}

function cacheStorageAvailable(): boolean {
  return typeof window !== "undefined" && typeof caches !== "undefined";
}

let cachePromise: Promise<Cache | null> | null = null;
function openCache(): Promise<Cache | null> {
  if (!cacheStorageAvailable()) return Promise.resolve(null);
  cachePromise ??= caches.open(CACHE_NAME).catch((error) => {
    console.warn("[zari:image] Cache Storage unavailable", error);
    return null;
  });
  return cachePromise;
}

function touch(url: string, bytes?: number) {
  const existing = meta.get(url);
  if (existing) {
    existing.lastUsed = Date.now();
    if (bytes && bytes !== existing.bytes) {
      cachedBytes += bytes - existing.bytes;
      existing.bytes = bytes;
    }
  } else if (bytes) {
    meta.set(url, { bytes, lastUsed: Date.now() });
    cachedBytes += bytes;
  }
  saveMeta();
}

/** Blob URLs currently handed out, ref-counted so a shared image is created once. */
const live = new Map<string, { objectUrl: string; refs: number }>();
const inflight = new Map<string, Promise<string>>();

/** Evict least-recently-used entries until we are back under the target. */
async function enforceBudget() {
  if (cachedBytes <= IMAGE_CACHE_TARGET_BYTES) return;
  const cache = await openCache();
  if (!cache) return;
  const candidates = [...meta.entries()]
    .filter(([url]) => !live.has(url)) // never evict what is on screen right now
    .sort((a, b) => a[1].lastUsed - b[1].lastUsed);
  for (const [url, entry] of candidates) {
    if (cachedBytes <= SOFT_TARGET_BYTES) break;
    try {
      await cache.delete(url);
    } catch {
      /* ignore */
    }
    meta.delete(url);
    cachedBytes -= entry.bytes;
    log("evict", { url, bytes: entry.bytes, cachedBytes });
  }
  saveMeta();
}

async function fetchAndStore(url: string): Promise<Blob> {
  const cache = await openCache();
  loadMeta();

  if (cache) {
    try {
      const hit = await cache.match(url);
      if (hit) {
        const blob = await hit.blob();
        touch(url, blob.size);
        log("hit", { url, bytes: blob.size });
        return blob;
      }
    } catch (error) {
      console.warn("[zari:image] cache read failed", { url, error });
    }
  }

  log("miss", { url });
  const response = await fetch(url, { mode: "cors", credentials: "omit" });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText} for ${url}`);
  }
  const blob = await response.blob();
  if (!blob.size || !blob.type.startsWith("image/")) {
    throw new Error(`Unexpected response type "${blob.type || "empty"}" for ${url}`);
  }
  if (cache && blob.size <= MAX_ENTRY_BYTES) {
    try {
      await cache.put(url, new Response(blob, { headers: { "Content-Type": blob.type } }));
      touch(url, blob.size);
      log("store", { url, bytes: blob.size, cachedBytes });
      void enforceBudget();
    } catch (error) {
      console.warn("[zari:image] cache write failed", { url, error });
    }
  }
  return blob;
}

/**
 * Returns a blob URL backed by the app cache. Throws on network/CORS/Storage failures so
 * the caller can fall back to a direct network <img src>.
 */
export async function acquireImage(url: string): Promise<string> {
  const existing = live.get(url);
  if (existing) {
    existing.refs += 1;
    touch(url);
    return existing.objectUrl;
  }
  const pending = inflight.get(url);
  if (pending) {
    const objectUrl = await pending;
    const entry = live.get(url);
    if (entry) entry.refs += 1;
    return objectUrl;
  }

  const task = (async () => {
    const blob = await fetchAndStore(url);
    const objectUrl = URL.createObjectURL(blob);
    live.set(url, { objectUrl, refs: 1 });
    return objectUrl;
  })().finally(() => inflight.delete(url));

  inflight.set(url, task);
  return task;
}

/** Release a blob URL once no mounted image references it. */
export function releaseImage(url: string) {
  const entry = live.get(url);
  if (!entry) return;
  entry.refs -= 1;
  if (entry.refs > 0) return;
  live.delete(url);
  URL.revokeObjectURL(entry.objectUrl);
}

/**
 * Background warm-up for images the shopper is about to scroll into. Writes into Cache
 * Storage without creating blob URLs, and stops as soon as the budget is reached so
 * scrolling a 500-product catalogue never queues unbounded downloads.
 */
export async function warmImages(urls: readonly string[]) {
  if (!cacheStorageAvailable()) return;
  loadMeta();
  for (const url of urls) {
    if (!url || meta.has(url) || live.has(url) || inflight.has(url)) continue;
    if (cachedBytes > IMAGE_CACHE_TARGET_BYTES * 0.8) return;
    try {
      await fetchAndStore(url);
    } catch (error) {
      console.warn("[zari:image] preload failed", { url, error: (error as Error).message });
    }
  }
}

/** Diagnostics only. */
export function imageCacheStats() {
  loadMeta();
  return {
    entries: meta.size,
    bytes: cachedBytes,
    target: IMAGE_CACHE_TARGET_BYTES,
    live: live.size,
  };
}
