/**
 * Product image lifecycle: keeps Storage and the products table consistent.
 *
 * Two failure modes this module exists to prevent:
 *  1. Orphans — an upload succeeds but the following product row write fails, leaving
 *     bytes in the bucket that nothing references. `discardUploads()` rolls those back.
 *  2. Dangling references — an image is deleted from Storage while another product (or a
 *     home banner) still points at it. `pruneUnreferencedImages()` deletes only paths
 *     that no remaining row references.
 *
 * Security: every call goes through the browser client, so Storage RLS decides whether
 * the caller may delete. Only admins can; for anyone else these helpers are no-ops that
 * fail silently rather than throwing over the admin UI.
 */
import { supabase, PRODUCT_IMAGE_BUCKET } from "./supabase";
import { pathFromStorageUrl, originalImageUrl } from "./image-url";

/** Storage object paths for the given public/signed URLs (non-storage URLs are skipped). */
export function toStoragePaths(urls: (string | null | undefined)[]): string[] {
  const paths = new Set<string>();
  for (const url of urls) {
    if (!url) continue;
    const path = pathFromStorageUrl(originalImageUrl(url), PRODUCT_IMAGE_BUCKET);
    if (path) paths.add(path);
  }
  return [...paths];
}

/** Best-effort deletion. Never throws: cleanup must not mask the original error. */
async function removePaths(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  try {
    await supabase.storage.from(PRODUCT_IMAGE_BUCKET).remove(paths);
  } catch {
    /* RLS denial or network hiccup — leave the object in place. */
  }
}

/**
 * Roll back uploads whose database write failed. Only safe for URLs created moments ago
 * by this same flow, which is why callers pass the exact list they just uploaded.
 */
export async function discardUploads(uploadedUrls: string[]): Promise<void> {
  await removePaths(toStoragePaths(uploadedUrls));
}

/**
 * Delete images that are no longer referenced by any product or banner.
 * A path still referenced anywhere is left untouched.
 */
export async function pruneUnreferencedImages(
  candidateUrls: string[],
  opts: { ignoreProductId?: string } = {},
): Promise<void> {
  const paths = toStoragePaths(candidateUrls);
  if (paths.length === 0) return;

  const stillUsed = new Set<string>();

  const productQuery = supabase.from("products").select("id, image_url, mockups");
  const { data: products } = opts.ignoreProductId
    ? await productQuery.neq("id", opts.ignoreProductId)
    : await productQuery;
  // A read failure means we cannot prove the image is unreferenced: keep everything.
  if (!products) return;

  for (const row of products) {
    for (const p of toStoragePaths([row.image_url, ...((row.mockups as string[] | null) ?? [])])) {
      stillUsed.add(p);
    }
  }

  const { data: banners } = await supabase.from("banners").select("image");
  if (!banners) return;
  for (const b of banners) for (const p of toStoragePaths([b.image])) stillUsed.add(p);

  await removePaths(paths.filter((p) => !stillUsed.has(p)));
}
