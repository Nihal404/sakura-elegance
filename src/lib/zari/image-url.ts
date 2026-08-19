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
const SIGN_SEGMENT = "/storage/v1/object/sign/";

/**
 * Stored records may still hold a signed URL (`/object/sign/...?token=`) from an earlier
 * upload flow. Signed URLs carry a per-request token, which defeats CDN/browser reuse and
 * eventually expires. `product-images` is a public bucket, so we rewrite them to the
 * stable public object path at read time — the stored row and the object itself are left
 * untouched, and uploads/deletes stay protected by Storage policies.
 */
export function normalizeStorageUrl(url: string): string {
  if (url.includes(SIGN_SEGMENT)) return url.replace(SIGN_SEGMENT, OBJECT_SEGMENT).split("?")[0]!;
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
