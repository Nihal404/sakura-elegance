/**
 * ============================================================
 *  PRODUCT MOCK SLIDES — single source of truth for the hero
 *  MorphSlider showcase on the home page.
 *
 *  >>> TO CHANGE A PRODUCT MOCK IMAGE: edit the `image` URL
 *  (and optionally the `caption`) of any entry below.
 *  Add or remove entries freely — the slider adapts.
 *  Images can be any public URL, an /uploaded asset, or a
 *  signed product image URL from the boutique catalogue.
 * ============================================================
 */
export interface ProductMockSlide {
  image: string;
  caption: string;
}

export const PRODUCT_MOCK_SLIDES: ProductMockSlide[] = [
  {
    image: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=1200&q=80",
    caption: "Sakura Silk Edit — Spring '26",
  },
  {
    image: "https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=1200&q=80",
    caption: "Chiffon Drapes in Blush",
  },
  {
    image: "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=1200&q=80",
    caption: "Rose Gold & Pearl Accessories",
  },
  {
    image: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=1200&q=80",
    caption: "Petal Atelier — Handcrafted Silhouettes",
  },
];

/**
 * Builds the slide list for the hero showcase.
 * If live catalogue products exist, their images are used first
 * (so the hero always mirrors real inventory); otherwise the
 * curated PRODUCT_MOCK_SLIDES above are shown.
 */
export function buildProductMockSlides(
  products: { name?: string; image?: string | null; images?: (string | null)[] | null }[] = [],
  limit = 5,
): ProductMockSlide[] {
  const fromCatalogue: ProductMockSlide[] = [];
  for (const p of products) {
    const image = p.image || p.images?.find(Boolean) || null;
    if (!image) continue;
    fromCatalogue.push({ image, caption: p.name || "Zari Boutique" });
    if (fromCatalogue.length >= limit) break;
  }
  return fromCatalogue.length >= 2 ? fromCatalogue : PRODUCT_MOCK_SLIDES;
}
