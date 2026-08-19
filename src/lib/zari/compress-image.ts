/**
 * Client-side image downscale before upload.
 *
 * Shoppers' bandwidth is only half the problem — storing ~1 MB originals for ~2,000
 * images also means every CDN transform starts from a huge source. We re-encode uploads
 * to WebP at a max edge of 1600px, which is more than enough for the detail gallery
 * (largest served variant is ~1200px) and typically cuts the stored bytes by 80–90%.
 *
 * Falls back to the original File whenever canvas/WebP is unavailable, so uploads never
 * fail because of the optimisation.
 */
const MAX_EDGE = 1600;
const QUALITY = 0.82;

export async function compressImage(file: File, maxEdge = MAX_EDGE): Promise<File> {
  if (typeof document === "undefined") return file;
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") return file;

  try {
    const bitmap = await loadBitmap(file);
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    // Nothing to gain: already small and already a modern format.
    if (scale === 1 && file.type === "image/webp" && file.size < 400_000) {
      close(bitmap);
      return file;
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      close(bitmap);
      return file;
    }
    ctx.drawImage(bitmap as CanvasImageSource, 0, 0, width, height);
    close(bitmap);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", QUALITY),
    );
    // Release the canvas backing store immediately.
    canvas.width = 0;
    canvas.height = 0;
    if (!blob || blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]+$/, "") + ".webp";
    return new File([blob], name, { type: "image/webp", lastModified: Date.now() });
  } catch {
    return file;
  }
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      /* fall through to <img> decoding */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return img;
  } finally {
    // The bitmap is already drawn from the element; revoke after the microtask queue.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

function close(bitmap: ImageBitmap | HTMLImageElement) {
  if ("close" in bitmap && typeof bitmap.close === "function") bitmap.close();
}
