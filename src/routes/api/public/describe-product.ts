import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// Public (cross-origin) AI endpoint. It lives under /api/public/* so the Vercel
// storefront can call this Lovable-hosted deployment, where LOVABLE_API_KEY is
// already available server-side. The key never leaves the server.
// Authorization: the caller must send an access token from the storefront's own
// Supabase project (header `x-store-access-token`) and be an admin there.

const STORE_SUPABASE_URL = "https://ubmxuhzlvyjomuopcoxk.supabase.co";
const STORE_PUBLISHABLE_KEY = "sb_publishable_4HVRiWgOTNeHeYzF6JBPSQ_Dz-3q1eN";

const schema = z.object({
  imageDataUrl: z.string().min(20).max(8_000_000),
  name: z.string().trim().max(120).optional(),
  category: z.string().trim().max(60).optional(),
});

const cors: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-store-access-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "content-type": "application/json" },
  });
}

async function isStoreAdmin(token: string): Promise<boolean> {
  const headers = { apikey: STORE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}` };
  const userRes = await fetch(`${STORE_SUPABASE_URL}/auth/v1/user`, { headers });
  if (!userRes.ok) return false;
  const user = (await userRes.json()) as { id?: string };
  if (!user.id) return false;
  const profileRes = await fetch(
    `${STORE_SUPABASE_URL}/rest/v1/profiles?select=role&id=eq.${user.id}`,
    { headers },
  );
  if (!profileRes.ok) return false;
  const rows = (await profileRes.json()) as { role?: string | null }[];
  return (rows[0]?.role ?? "").toLowerCase() === "admin";
}

export const Route = createFileRoute("/api/public/describe-product")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      POST: async ({ request }) => {
        const key = process.env["LOVABLE_API_KEY"];
        if (!key) return json({ error: "AI is not configured on the server." }, 503);

        const token = (request.headers.get("x-store-access-token") ?? "").trim();
        if (!token) return json({ error: "Please sign in as an admin and try again." }, 401);
        const allowed = await isStoreAdmin(token).catch(() => false);
        if (!allowed) return json({ error: "Only admins can generate descriptions." }, 403);

        let parsed: z.infer<typeof schema>;
        try {
          parsed = schema.parse(await request.json());
        } catch {
          return json({ error: "Add a product image first, then try again." }, 400);
        }
        if (!/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(parsed.imageDataUrl)) {
          return json({ error: "Use a JPG, PNG or WebP product photo." }, 400);
        }

        const prompt = `You are a copywriter for "Zari Boutique", an elegant Indian clothing and accessories boutique with a soft pink Sakura aesthetic.
Look at the product image and write catalog copy grounded ONLY in what is visible.
${parsed.name ? `Product name: ${parsed.name}.` : ""}${parsed.category ? ` Category: ${parsed.category}.` : ""}
Rules: never invent fabric composition, brand, designer, measurements, price, care instructions, certifications, origin or claims you cannot see. If a detail is unclear, describe it in visual terms instead of guessing.
Respond with ONLY minified JSON, no markdown, shaped exactly:
{"description":"2-3 sentence elegant description of what is visible (colour, pattern, embroidery/detailing, silhouette, styling occasion)","features":["up to 8 short highlight chips, max 5 words each, visible details only"]}`;

        let res: Response;
        try {
          res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            signal: AbortSignal.timeout(45_000),
            headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                {
                  role: "user",
                  content: [
                    { type: "text", text: prompt },
                    { type: "image_url", image_url: { url: parsed.imageDataUrl } },
                  ],
                },
              ],
            }),
          });
        } catch (err) {
          const timedOut = err instanceof Error && err.name === "TimeoutError";
          console.error("[describe-product] gateway unreachable", err);
          return json(
            {
              error: timedOut
                ? "The AI took too long to respond. Try a smaller photo or try again."
                : "Could not reach the AI service. Please try again.",
            },
            timedOut ? 504 : 502,
          );
        }


        if (!res.ok) {
          const text = await res.text();
          console.error("[describe-product] gateway error", res.status, text.slice(0, 500));
          if (res.status === 429)
            return json({ error: "AI rate limit reached — try again in a moment." }, 429);
          if (res.status === 402)
            return json({ error: "AI credits exhausted. Top up to keep using this." }, 402);
          if (res.status === 400)
            return json({ error: "The AI could not read that image. Try a clearer photo." }, 400);
          return json({ error: "The AI service failed. Please try again." }, 502);
        }

        const payload = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        const raw = payload.choices?.[0]?.message?.content ?? "";
        const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
        const match = cleaned.match(/\{[\s\S]*\}/);

        let description = "";
        let features: string[] = [];
        if (match) {
          try {
            const obj = JSON.parse(match[0]) as { description?: string; features?: unknown };
            description = typeof obj.description === "string" ? obj.description.trim() : "";
            features = Array.isArray(obj.features)
              ? obj.features.filter((f): f is string => typeof f === "string").slice(0, 8)
              : [];
          } catch {
            description = cleaned;
          }
        } else {
          description = cleaned;
        }

        if (!description) return json({ error: "The AI returned no description. Try again." }, 502);
        return json({ description, features });
      },
    },
  },
});
