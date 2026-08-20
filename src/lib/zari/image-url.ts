/**
 * Sized image delivery for Zari Boutique.
 *
 * Originals live in the public `product-images` bucket (1–2 MB each) and must never be
 * downloaded for a product grid. Supabase Storage image transformations serve a resized
 * variant from the same CDN:
 *
 *   /storage/v1/object/public/<bucket>/<path>          -> original
 *   /storage/v1/render/image/public/<bucket>/<path>?width=..&quality=..
 *
 * Format is negotiated from the browser's Accept header (WebP where supported), so we do
 * not request extra variants per format. If transformations are ever unavailable on the
 * project's plan, the first failing request flips `transformsEnabled` off and every image
 * silently falls back to the original URL — uploads and stored records are unaffected.
 */

const RENDER_SEGMENT = "/storage/v1/render/image/public/";
const OBJECT_SEGMENT = "/storage/v1/object/public/";

/**
 * `product-images` is a PRIVATE bucket on this project, so stored records hold long-lived
 * signed URLs (`/object/sign/...?token=`). Those must be served verbatim: stripping the
 * token (or swapping in the public path) makes Storage answer 400/404. Signed URLs also
 * cannot be resized at read time — the transform variant has to be baked in at sign time —
 * so they are simply passed through untouched.
 */
export function normalizeStorageUrl(url: string): string {
  return url;
}

let transformsEnabled = true;

/** Called by <ProductImage> when a transformed URL fails to load. */
export function disableImageTransforms() {
  transformsEnabled = false;
}

export function imageTransformsEnabled() {
  return transformsEnabled;
}

/** Only Supabase-hosted public objects can be transformed. */
export function isTransformable(url: string | undefined | null): url is string {
  return Boolean(url && normalizeStorageUrl(url).includes(OBJECT_SEGMENT));
}

export function originalImageUrl(url: string): string {
  const normalized = normalizeStorageUrl(url);
  return normalized.includes(RENDER_SEGMENT)
    ? normalized.replace(RENDER_SEGMENT, OBJECT_SEGMENT).split("?")[0]!
    : normalized;
}

/** Snap to a small set of widths so the CDN keeps a high hit rate. */
export const CARD_WIDTHS = [320, 400, 500] as const;
export const DETAIL_WIDTHS = [800, 1000, 1200] as const;

function snap(width: number, allowed: readonly number[]): number {
  return allowed.find((w) => w >= width) ?? allowed[allowed.length - 1]!;
}

export interface SizedOptions {
  width: number;
  quality?: number;
  /** Snap the requested width to the card or detail ladder. */
  ladder?: readonly number[];
}

/** A CDN URL for `url` at roughly `width` CSS px. Falls back to the original when needed. */
export function sizedImageUrl(url: string | undefined | null, opts: SizedOptions): string {
  if (!url) return "";
  // Private-bucket objects can only be resized at sign time; reuse a previously signed
  // variant when we have one so even plain <img> call sites get the small file.
  const cached = cachedVariantUrl(url, {
    width: opts.width,
    quality: opts.quality ?? 70,
    ladder: opts.ladder ?? CARD_WIDTHS,
  });
  if (cached) return cached;
  if (!transformsEnabled || !isTransformable(url)) return originalImageUrl(url);
  const width = snap(Math.round(opts.width), opts.ladder ?? CARD_WIDTHS);
  const quality = opts.quality ?? 72;
  const base = originalImageUrl(url).replace(OBJECT_SEGMENT, RENDER_SEGMENT);
  return `${base}?width=${width}&quality=${quality}&resize=cover`;
}


/** Grid/card variant: mobile gets the smallest rung, desktop a slightly larger one. */
export function cardImageUrl(url: string | undefined | null, width = 400): string {
  return sizedImageUrl(url, { width, quality: 70, ladder: CARD_WIDTHS });
}

/** Thumbnail strip / cart line item. */
export function thumbImageUrl(url: string | undefined | null, width = 160): string {
  return sizedImageUrl(url, { width, quality: 65, ladder: [160, 240, 320] });
}

/** Product detail gallery variant (~800–1200px). */
export function galleryImageUrl(url: string | undefined | null, width = 1000): string {
  return sizedImageUrl(url, { width, quality: 78, ladder: DETAIL_WIDTHS });
}

/**
 * `sizes` for a 2-up mobile / 4-up desktop grid. Paired with a srcset this lets the
 * browser pick 320px on phones and ~400–500px on desktop.
 */
export const CARD_SIZES = "(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 320px";

export function cardSrcSet(url: string | undefined | null): string | undefined {
  if (!url || !transformsEnabled || !isTransformable(url)) return undefined;
  return CARD_WIDTHS.map((w) => `${cardImageUrl(url, w)} ${w}w`).join(", ");
}

export const GALLERY_SIZES = "(max-width: 1024px) 92vw, 620px";

export function gallerySrcSet(url: string | undefined | null): string | undefined {
  if (!url || !transformsEnabled || !isTransformable(url)) return undefined;
  return DETAIL_WIDTHS.map((w) => `${galleryImageUrl(url, w)} ${w}w`).join(", ");
}

/* -------------------------------------------------------------------------- */
/*  Robust source resolution                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Product records normally store a fully-qualified signed URL. Older/hand-entered rows may
 * instead hold a bare storage path ("product-images/abc/1.jpg" or "abc/1.jpg"), and a signed
 * URL can in principle carry an expiry that has passed. Both cases render as a permanent
 * placeholder unless we resolve them, so <ProductImage> asks this helper first.
 */
const SIGN_SEGMENT = "/storage/v1/object/sign/";
const RENDER_SIGN_SEGMENT = "/storage/v1/render/image/sign/";


export function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value) || value.startsWith("data:") || value.startsWith("blob:");
}

/** Bucket-relative object path for a bare (non-URL) value, or null. */
export function storageObjectPath(value: string, bucket: string): string | null {
  if (!value || isHttpUrl(value)) return null;
  const clean = value.replace(/^\/+/, "");
  return clean.startsWith(`${bucket}/`) ? clean.slice(bucket.length + 1) : clean;
}

/** True when a signed URL's embedded token is expired (or expires within 60s). */
export function signedUrlExpired(url: string): boolean {
  if (!url.includes(SIGN_SEGMENT)) return false;
  const token = new URL(url, "https://x.invalid").searchParams.get("token");
  const payload = token?.split(".")[1];
  if (!payload) return false;
  try {
    const json = JSON.parse(
      atob(payload.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(payload.length / 4) * 4, "=")),
    ) as { exp?: number };
    return typeof json.exp === "number" && json.exp * 1000 < Date.now() + 60_000;
  } catch {
    return false;
  }
}

/** Object path for any Supabase storage URL (signed, public or render variant). */
export function pathFromStorageUrl(url: string, bucket: string): string | null {
  const marker = [RENDER_SIGN_SEGMENT, SIGN_SEGMENT, OBJECT_SEGMENT, RENDER_SEGMENT].find((m) =>
    url.includes(m),
  );
  if (!marker) return null;
  const rest = url.split(marker)[1]?.split("?")[0];

  if (!rest) return null;
  const decoded = decodeURIComponent(rest);
  return decoded.startsWith(`${bucket}/`) ? decoded.slice(bucket.length + 1) : decoded;
}

/** A source only needs the async (signing) path when it is bare or stale. */
export function needsSigning(value: string | undefined | null): value is string {
  if (!value) return false;
  return !isHttpUrl(value) || signedUrlExpired(value);
}

const signedCache = new Map<string, string>();
const inflight = new Map<string, Promise<string>>();
/** One year, matching how product images were originally signed. */
const SIGN_TTL_SECONDS = 60 * 60 * 24 * 365;

/**
 * Turns a bare path or an expired signed URL into a usable signed URL. Results are cached
 * per path so a grid of cards signs each object at most once.
 */
export async function resolveSignedSrc(value: string): Promise<string> {
  const { supabase, PRODUCT_IMAGE_BUCKET } = await import("./supabase");
  const path = storageObjectPath(value, PRODUCT_IMAGE_BUCKET) ?? pathFromStorageUrl(value, PRODUCT_IMAGE_BUCKET);
  if (!path) return value;

  const cached = signedCache.get(path);
  if (cached) return cached;
  const pending = inflight.get(path);
  if (pending) return pending;

  const task = (async () => {
    const { data, error } = await supabase.storage
      .from(PRODUCT_IMAGE_BUCKET)
      .createSignedUrl(path, SIGN_TTL_SECONDS);
    if (error || !data?.signedUrl) {
      // Last resort: the public endpoint (works when the bucket is public).
      return supabase.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;
    }
    signedCache.set(path, data.signedUrl);
    return data.signedUrl;
  })().finally(() => inflight.delete(path));

  inflight.set(path, task);
  return task;
}

/* -------------------------------------------------------------------------- */
/*  Resized variants for the PRIVATE bucket (signed render URLs)              */
/* -------------------------------------------------------------------------- */

/**
 * `product-images` is private on this project (workspace policy blocks public buckets),
 * so a stored `/object/sign/...` URL always serves the ORIGINAL — 2.5–4 MB per photo.
 * Six cards then cost ~18 MB, which is what stalls the grid on mobile data and leaves the
 * pink placeholder up.
 *
 * Storage can still resize a private object, but the transform has to be baked into the
 * token at sign time (`createSignedUrl(path, ttl, { transform })` -> `/render/image/sign/...`).
 * We therefore mint one right-sized signed variant per (path, width) and cache it in
 * localStorage, so a card image is ~40–90 KB instead of megabytes and repeat visits skip
 * the signing round trip entirely.
 */

export interface VariantRequest {
  width: number;
  quality?: number;
  ladder?: readonly number[];
}

// v2 invalidates the old `resize: cover` URLs. With only a width supplied, Storage
// produced malformed portrait variants (for example 4000×3000 -> 1000×3000), which
// made landscape product photos appear as a narrow, zoomed strip in the gallery.
const VARIANT_STORE_KEY = "zari.img.variants.v2";
/** Sign for a year; refresh when less than a week remains. */
const VARIANT_TTL_SECONDS = 60 * 60 * 24 * 365;
const VARIANT_REFRESH_MS = 7 * 24 * 60 * 60 * 1000;

interface VariantRecord {
  url: string;
  /** ms epoch when the token stops being trustworthy. */
  exp: number;
}

const variantMemory = new Map<string, VariantRecord>();
const variantInflight = new Map<string, Promise<string>>();
let variantStoreLoaded = false;

function loadVariantStore() {
  if (variantStoreLoaded || typeof localStorage === "undefined") return;
  variantStoreLoaded = true;
  try {
    const raw = localStorage.getItem(VARIANT_STORE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, VariantRecord>;
    const now = Date.now();
    for (const [key, rec] of Object.entries(parsed)) {
      if (rec?.url && rec.exp > now) variantMemory.set(key, rec);
    }
  } catch {
    /* corrupt or unavailable storage: just re-sign */
  }
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;
function persistVariantStore() {
  if (typeof localStorage === "undefined") return;
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    try {
      // Cap the map so localStorage can never grow without bound.
      const entries = [...variantMemory.entries()].slice(-600);
      variantMemory.clear();
      for (const [k, v] of entries) variantMemory.set(k, v);
      localStorage.setItem(VARIANT_STORE_KEY, JSON.stringify(Object.fromEntries(entries)));
    } catch {
      /* quota or private mode: memory cache still works */
    }
  }, 400);
}

function variantKey(path: string, width: number, quality: number) {
  return `${path}|${width}|${quality}`;
}

/** True for anything that lives in our Storage bucket (URL or bare path). */
export function isStorageSource(value: string | undefined | null): value is string {
  if (!value) return false;
  if (!isHttpUrl(value)) return true;
  return (
    value.includes(SIGN_SEGMENT) ||
    value.includes(RENDER_SIGN_SEGMENT) ||
    value.includes(OBJECT_SEGMENT) ||
    value.includes(RENDER_SEGMENT)
  );
}

function resolveVariantSpec(req: VariantRequest) {
  const width = snap(Math.round(req.width || 400), req.ladder ?? CARD_WIDTHS);
  const quality = req.quality ?? 70;
  return { width, quality };
}

/**
 * Synchronous best guess: a previously signed variant for this source/width, else null.
 * Lets a re-render or a return visit paint immediately without awaiting Storage.
 */
export function cachedVariantUrl(
  value: string | undefined | null,
  req: VariantRequest,
  bucket = "product-images",
): string | null {
  if (!isStorageSource(value)) return null;
  loadVariantStore();
  const path = storageObjectPath(value, bucket) ?? pathFromStorageUrl(value, bucket);
  if (!path) return null;
  const { width, quality } = resolveVariantSpec(req);
  const rec = variantMemory.get(variantKey(path, width, quality));
  return rec && rec.exp > Date.now() ? rec.url : null;
}

/**
 * Mints (or reuses) a signed, resized URL for a Storage object. Non-Storage sources
 * (Unsplash and friends) are returned untouched — they already support `?w=`.
 */
export async function signedVariantUrl(
  value: string,
  req: VariantRequest,
  opts: { force?: boolean } = {},
): Promise<string> {
  if (!isStorageSource(value)) return value;
  const { supabase, PRODUCT_IMAGE_BUCKET } = await import("./supabase");
  const path =
    storageObjectPath(value, PRODUCT_IMAGE_BUCKET) ??
    pathFromStorageUrl(value, PRODUCT_IMAGE_BUCKET);
  if (!path) return value;

  const { width, quality } = resolveVariantSpec(req);
  const key = variantKey(path, width, quality);
  loadVariantStore();

  if (!opts.force) {
    const rec = variantMemory.get(key);
    if (rec && rec.exp > Date.now() + VARIANT_REFRESH_MS) return rec.url;
    const pending = variantInflight.get(key);
    if (pending) return pending;
  }

  const task = (async () => {
    const sign = (transform?: { width: number; quality: number; resize: "contain" }) =>
      supabase.storage
        .from(PRODUCT_IMAGE_BUCKET)
        .createSignedUrl(path, VARIANT_TTL_SECONDS, transform ? { transform } : undefined);

    let { data, error } = transformsEnabled
      ? await sign({ width, quality, resize: "contain" })
      : await sign();

    if ((error || !data?.signedUrl) && transformsEnabled) {
      // Transformations unavailable (plan/feature): fall back to full-size signed URLs.
      console.warn("[zari:image] resize unavailable, serving original", { path, error });
      disableImageTransforms();
      ({ data, error } = await sign());
    }
    if (error || !data?.signedUrl) {
      console.warn("[zari:image] createSignedUrl failed", { path, width, error });
      // Public endpoint as a last resort (works if the bucket ever becomes public).
      return supabase.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;
    }
    variantMemory.set(key, {
      url: data.signedUrl,
      exp: Date.now() + VARIANT_TTL_SECONDS * 1000,
    });
    persistVariantStore();
    return data.signedUrl;
  })().finally(() => variantInflight.delete(key));

  variantInflight.set(key, task);
  return task;
}

/** Drop any cached variant for a source — used before a forced re-sign after an error. */
export function invalidateVariants(value: string, bucket = "product-images") {
  const path = storageObjectPath(value, bucket) ?? pathFromStorageUrl(value, bucket);
  if (!path) return;
  for (const key of [...variantMemory.keys()]) {
    if (key.startsWith(`${path}|`)) variantMemory.delete(key);
  }
  persistVariantStore();
}
