// Client helper for the admin "Regenerate with AI" button.
// Posts a downscaled copy of the chosen product photo to /api/describe-product,
// which holds the AI key server-side.

const MAX_EDGE = 1024;

/** Shrinks a data URL to a JPEG no larger than MAX_EDGE so the request stays small. */
export async function shrinkImageDataUrl(dataUrl: string): Promise<string> {
  if (typeof document === "undefined") return dataUrl;
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("bad image"));
      el.src = dataUrl;
    });
    const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
    if (scale === 1 && dataUrl.length < 1_200_000) return dataUrl;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return dataUrl;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.82);
  } catch {
    return dataUrl;
  }
}

export async function describeProductImage(input: {
  imageDataUrl: string;
  name?: string;
  category?: string;
}): Promise<{ description: string; features: string[] }> {
  if (!input.imageDataUrl) throw new Error("Add a product image first.");
  const imageDataUrl = await shrinkImageDataUrl(input.imageDataUrl);

  let res: Response;
  try {
    res = await fetch("/api/describe-product", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...input, imageDataUrl }),
    });
  } catch {
    throw new Error("Network error — could not reach the AI service.");
  }

  const text = await res.text();
  let body: { description?: string; features?: string[]; error?: string } = {};
  try {
    body = JSON.parse(text) as typeof body;
  } catch {
    /* non-JSON response */
  }

  if (!res.ok || !body.description) {
    throw new Error(body.error || `AI request failed (${res.status}). Please try again.`);
  }
  return { description: body.description, features: body.features ?? [] };
}
