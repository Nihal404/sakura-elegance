import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  imageDataUrl: z.string().min(20),
  name: z.string().trim().max(120).optional(),
  category: z.string().trim().max(60).optional(),
});

export const describeProductImage = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data }) => {
    const key = process.env['LOVABLE_API_KEY'];
    if (!key) throw new Error("AI is not configured.");

    const prompt = `You are a copywriter for "Zari Boutique", an elegant Indian clothing and accessories boutique with a soft pink Sakura aesthetic.
Look at the product image and write catalog copy.
${data.name ? `Product name: ${data.name}.` : ""}${data.category ? ` Category: ${data.category}.` : ""}
Respond with ONLY minified JSON, no markdown, shaped exactly:
{"description":"2-3 sentence elegant product description based on what you actually see (colour, fabric, embroidery, silhouette, occasion)","features":["4 short highlight chips, max 4 words each"]}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: data.imageDataUrl } },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      if (res.status === 429) throw new Error("AI rate limit reached, try again shortly.");
      if (res.status === 402) throw new Error("AI credits exhausted.");
      throw new Error(`AI request failed: ${body.slice(0, 200)}`);
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const raw = json.choices?.[0]?.message?.content ?? "";
    const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
    const match = cleaned.match(/\{[\s\S]*\}/);

    let description = "";
    let features: string[] = [];
    if (match) {
      try {
        const parsed = JSON.parse(match[0]) as { description?: string; features?: unknown };
        description = typeof parsed.description === "string" ? parsed.description.trim() : "";
        features = Array.isArray(parsed.features)
          ? parsed.features.filter((f): f is string => typeof f === "string").slice(0, 8)
          : [];
      } catch {
        description = cleaned;
      }
    } else {
      description = cleaned;
    }

    if (!description) throw new Error("AI could not describe this image.");
    return { description, features };
  });
