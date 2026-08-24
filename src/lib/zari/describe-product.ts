// Client helper for the admin "Regenerate with AI" button.
// Posts a downscaled copy of the chosen product photo to the server route that
// holds the AI key. On Vercel (where the Lovable AI key is not present) it
// automatically falls back to the Lovable-hosted deployment of this same app,
// which already has the key server-side. The key never reaches the browser.

import { supabase } from "@/lib/zari/supabase";

const MAX_EDGE = 1024;
const PATH = "/api/public/describe-product";
const PROJECT_ID = "606f008d-2371-40a9-9ca2-0d957ec9846f";

const FALLBACK_ORIGINS = [
  import.meta.env["VITE_ZARI_AI_ORIGIN"] as string | undefined,
  `https://project--${PROJECT_ID}.lovable.app`,
  `https://project--${PROJECT_ID}-dev.lovable.app`,
].filter((o): o is string => typeof o === "string" && o.length > 0);

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

type Result = { description: string; features: string[] };
type Parsed = {
  ok: boolean;
  status: number;
  body: { description?: string; features?: string[]; error?: string };
};

async function post(url: string, payload: unknown, token: string): Promise<Parsed> {
  const res = await fetch(url, {
    method: "POST",
    signal: AbortSignal.timeout(60_000),
    headers: { "content-type": "application/json", "x-store-access-token": token },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let body: Parsed["body"] = {};
  try {
    body = JSON.parse(text) as Parsed["body"];
  } catch {
    /* non-JSON (e.g. HTML error page) */
  }
  return { ok: res.ok, status: res.status, body };
}

export async function describeProductImage(input: {
  imageDataUrl: string;
  name?: string;
  category?: string;
}): Promise<Result> {
  if (!input.imageDataUrl) throw new Error("Add a product image first.");

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Please sign in as an admin and try again.");

  const imageDataUrl = await shrinkImageDataUrl(input.imageDataUrl);
  const payload = { ...input, imageDataUrl };

  const targets = [PATH, ...FALLBACK_ORIGINS.map((o) => `${o.replace(/\/$/, "")}${PATH}`)];
  let lastError = "The AI service is unavailable. Please try again.";

  for (const url of targets) {
    let attempt: Parsed;
    try {
      attempt = await post(url, payload, token);
    } catch (err) {
      lastError =
        err instanceof Error && err.name === "TimeoutError"
          ? "The AI request timed out. Try again with a smaller photo."
          : "Network error — could not reach the AI service.";
      continue; // try the next host
    }
    if (attempt.ok && attempt.body.description) {
      return { description: attempt.body.description, features: attempt.body.features ?? [] };
    }
    lastError = attempt.body.error || `AI request failed (${attempt.status}).`;
    // Only a missing/absent AI configuration is worth retrying elsewhere.
    if (attempt.status !== 503 && attempt.status !== 404) throw new Error(lastError);
  }

  throw new Error(lastError);
}
