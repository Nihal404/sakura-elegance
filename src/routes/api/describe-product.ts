import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// Raw HTTP endpoint so the admin form can post a (possibly large) image payload
// and get precise status codes back. The AI key stays server-side only.
const schema = z.object({
  imageDataUrl: z.string().min(20).max(8_000_000),
  name: z.string().trim().max(120).optional(),
  category: z.string().trim().max(60).optional(),
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export const Route = createFileRoute("/api/describe-product")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env["LOVABLE_API_KEY"];
        if (!key) {
          return json(
            {
              error:
                "AI is not configured on the server. Add the LOVABLE_API_KEY secret to this deployment, then redeploy.",
            },
            503,
          );
        }

        let parsed: z.infer<typeof schema>;
        try {
          parsed = schema.parse(await request.json());
        } catch {
          return json({ error: "Add a product image first, then try again." }, 400);
        }

        if (!/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(parsed.imageDataUrl)) {
          return json(
            { error: "That image format isn't supported. Use a JPG, PNG or WebP photo." },
            400,
          );
        }

        const prompt = `You are a copywriter for "Zari Boutique", an elegant Indian clothing and accessories boutique with a soft pink Sakura aesthetic.
Look at the product image and write catalog copy.
${parsed.name ? `Product name: ${parsed.name}.` : ""}${parsed.category ? ` Category: ${parsed.category}.` : ""}
Respond with ONLY minified JSON, no markdown, shaped exactly:
{"description":"2-3 sentence elegant product description based on what you actually see (colour, fabric, embroidery, silhouette, occasion)","features":["4 short highlight chips, max 4 words each"]}`;

        let res: Response;
        try {
          res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
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
          console.error("[describe-product] gateway unreachable", err);
          return json({ error: "Could not reach the AI service. Please try again." }, 502);
        }

        if (!res.ok) {
          const body = await res.text();
          console.error("[describe-product] gateway error", res.status, body.slice(0, 500));
          if (res.status === 429)
            return json({ error: "AI rate limit reached — try again in a moment." }, 429);
          if (res.status === 402)
            return json({ error: "AI credits exhausted. Top up to keep using this." }, 402);
          if (res.status === 400)
            return json(
              { error: "The AI could not read that image. Try a clearer product photo." },
              400,
            );
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
