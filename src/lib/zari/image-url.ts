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
  const marker = [SIGN_SEGMENT, OBJECT_SEGMENT, RENDER_SEGMENT].find((m) => url.includes(m));
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
