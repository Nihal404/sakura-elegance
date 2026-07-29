import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "post_review",
  title: "Post a product review",
  description: "Post a review (1-5 stars) for a product as the signed-in user.",
  inputSchema: {
    product_id: z.string().uuid().describe("UUID of the product."),
    name: z.string().trim().min(1).max(80).describe("Display name shown with the review."),
    rating: z.number().int().min(1).max(5).describe("Star rating between 1 and 5."),
    comment: z.string().trim().min(1).max(1000).describe("Review text."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ product_id, name, rating, comment }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const { data, error } = await supabaseForUser(ctx)
      .from("reviews")
      .insert({ product_id, name, rating, comment, user_id: ctx.getUserId() })
      .select()
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { review: data },
    };
  },
});
