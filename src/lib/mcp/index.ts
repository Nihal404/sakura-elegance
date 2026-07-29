import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listProductsTool from "./tools/list-products";
import getMyProfileTool from "./tools/get-my-profile";
import postReviewTool from "./tools/post-review";
import listMyReviewsTool from "./tools/list-my-reviews";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "zari-boutique-mcp",
  title: "Zari Boutique MCP",
  version: "0.1.0",
  instructions:
    "Tools for the Zari Boutique storefront. Use `list_products` to browse the catalog; signed-in users can read their profile, list their reviews, and post new reviews.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listProductsTool, getMyProfileTool, listMyReviewsTool, postReviewTool],
});
