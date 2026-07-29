import { createClient } from "@supabase/supabase-js";
import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "list_products",
  title: "List products",
  description: "List products in the Zari Boutique catalog. Optionally filter by category.",
  inputSchema: {
    category: z.string().trim().min(1).optional().describe("Optional category filter (e.g. 'Sarees')."),
    limit: z.number().int().min(1).max(50).optional().describe("Max items to return (default 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ category, limit }) => {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    let q = supabase
      .from("products")
      .select("id, name, price, category, description, image_url")
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);
    if (category) q = q.eq("category", category);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { products: data ?? [] },
    };
  },
});
