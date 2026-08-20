import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Plus, Minus, ShoppingBag, Sparkles, Loader2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { ProductReviews } from "@/components/ProductReviews";
import { ProductMorphGallery } from "@/components/ProductMorphGallery";

import { supabase } from "@/lib/zari/supabase";
import { fetchProductById, type Product } from "@/lib/zari/products";
import { imageBudget } from "@/lib/zari/image-cache";
import {
  DETAIL_WIDTHS,
  galleryImageUrl,
  thumbImageUrl,
  type VariantRequest,
} from "@/lib/zari/image-url";
import { useSizedSrcList } from "@/hooks/useSizedImage";

const GALLERY_SPEC: VariantRequest = { width: 1000, quality: 78, ladder: DETAIL_WIDTHS };
const THUMB_SPEC: VariantRequest = { width: 160, quality: 65, ladder: [160, 240, 320] };
import { useShoppingLists } from "@/lib/shopping-lists";
import { CompareButton, WishlistButton } from "@/components/WishlistCompareControls";
import { playAddToCartSound } from "@/lib/zari/sound";


const SITE_URL = "https://zaris-elegance.lovable.app";

export const Route = createFileRoute("/product/$id")({
  loader: async ({ params }) => {
    try {
      const { data } = await supabase
        .from("products")
        .select("name, price, image_url, description, category")
        .eq("id", params.id)
        .maybeSingle();
      return { seo: data ?? null };
    } catch {
      return { seo: null };
    }
  },
  head: ({ params, loaderData }) => {
    const p = loaderData?.seo;
    const name = p?.name ?? "Product";
    const title = `${name} — Zari Boutique`.slice(0, 60);
    const description =
      (p?.description && p.description.slice(0, 155)) ||
      `Shop ${name} at Zari Boutique — elegant ${p?.category?.toLowerCase() ?? "pieces"} with prices in INR and 2–7 day shipping.`;
    const url = `${SITE_URL}/product/${params.id}`;

    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "product" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary_large_image" },
        ...(p?.image_url?.startsWith("https://")
          ? [
              { property: "og:image", content: p.image_url },
              { name: "twitter:image", content: p.image_url },
            ]
          : []),
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: p
        ? [
            {
              type: "application/ld+json",
              children: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "Product",
                name: p.name,
                description,
                ...(p.image_url ? { image: p.image_url } : {}),
                category: p.category,
                brand: { "@type": "Brand", name: "Zari Boutique" },
                offers: {
                  "@type": "Offer",
                  price: Number(p.price),
                  priceCurrency: "INR",
                  availability: "https://schema.org/InStock",
                  url,
                },
              }),
            },
          ]
        : [],
    };
  },
  component: ProductDetail,
});


function ProductDetail() {
  const { id } = Route.useParams();
  const router = useRouter();
  const { products, addToCart } = useStore();
  const [qty, setQty] = useState(1);
  const [activeView, setActiveView] = useState(0);

  const cached = products.find((p) => p.id === id);
  const [fetched, setFetched] = useState<Product | null>(null);
  const [loadingProduct, setLoadingProduct] = useState(!cached);

  // The listing pages only carry card columns, so the detail row (description, features,
  // mockups) is fetched here for this product alone. Stale responses are dropped.
  useEffect(() => {
    setActiveView(0);
    // Listing rows only carry image_url, so `cached.mockups` is a single-item fallback.
    // Only skip the detail fetch when we truly already have the full gallery.
    if (cached && cached.mockups.length > 1 && cached.description) {
      setFetched(null);
      setLoadingProduct(false);
      return;
    }
    const controller = new AbortController();

    setLoadingProduct(true);
    void fetchProductById(id, controller.signal)
      .then((p) => {
        if (!controller.signal.aborted) setFetched(p);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!controller.signal.aborted) setLoadingProduct(false);
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Recently viewed: one throttled record per product open (see VIEW_THROTTLE_MS).
  const { recordView } = useShoppingLists();
  useEffect(() => {
    recordView(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const product = fetched ?? cached;

  // Right-sized (signed) variants for the gallery + thumb strip. Resolved unconditionally,
  // above the early returns, so hook order stays stable.
  const rawViews =
    product?.mockups && product.mockups.length > 0
      ? product.mockups
      : product?.image
        ? [product.image, product.image, product.image, product.image]
        : [];
  const gallerySrcs = useSizedSrcList(rawViews, GALLERY_SPEC);
  const galleryThumbs = useSizedSrcList(rawViews, THUMB_SPEC);


  if (loadingProduct && !product) {
    return (
      <div className="mx-auto max-w-7xl px-6 lg:px-10 py-10 lg:py-14">
        <div className="h-4 w-16 rounded-full bg-primary/10 animate-pulse mb-8" />
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16">
          <div>
            <div className="aspect-[4/5] rounded-3xl bg-sakura-gradient animate-pulse" />
            <div className="mt-4 grid grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="aspect-square rounded-2xl bg-primary/10 animate-pulse" />
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <div className="h-3 w-24 rounded-full bg-primary/20 animate-pulse" />
            <div className="h-10 w-3/4 rounded-full bg-primary/10 animate-pulse" />
            <div className="h-8 w-32 rounded-full bg-primary/15 animate-pulse mt-2" />
            <div className="h-px bg-border/70 my-4" />
            <div className="h-4 w-full rounded-full bg-primary/10 animate-pulse" />
            <div className="h-4 w-5/6 rounded-full bg-primary/10 animate-pulse" />
            <div className="h-4 w-4/6 rounded-full bg-primary/10 animate-pulse" />
            <div className="grid grid-cols-2 gap-3 mt-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-12 rounded-2xl bg-blush/60 animate-pulse" />
              ))}
            </div>
            <div className="h-12 rounded-full bg-primary/20 animate-pulse mt-6" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="font-serif text-3xl">Piece not found</h1>
        <p className="mt-3 text-muted-foreground">
          This blossom may have moved on. Explore the rest of the collection.
        </p>
        <Link
          to="/shop"
          className="mt-6 inline-flex px-6 py-3 rounded-full bg-primary text-primary-foreground shadow-soft"
        >
          Back to shop
        </Link>
      </div>
    );
  }

  const description =
    product.description?.trim()
      ? product.description
      : product.category === "Clothing"
        ? `Crafted for effortless elegance, the ${product.name} drapes the wearer in whisper-soft fabric with a hand-finished silhouette. Rose-toned stitching and subtle floral motifs bring a modern romance to a timeless piece — perfect for garden weddings, twilight dinners, and quiet afternoons alike.`
        : `A refined accent piece, the ${product.name} is finished by hand with delicate rose-gold detailing. Designed to complement the Sakura palette, it layers beautifully with everyday looks and special occasions — a small heirloom in the making.`;

  // Prefer admin-uploaded mockups; fall back to synthetic framed views of the main image.
  const hasMockups = product.mockups && product.mockups.length > 0;
  const syntheticViews = [
    { label: "Studio", frame: "bg-blush", transform: "" },
    { label: "Lookbook", frame: "bg-sakura", transform: "scale-110 translate-y-2" },
    { label: "Detail", frame: "bg-background", transform: "scale-[1.35]" },
    { label: "Editorial", frame: "bg-primary/15", transform: "scale-105 -translate-x-3" },
  ];
  // Detail-sized variants (~800–1200px), not the multi-MB originals.
  const gallery = hasMockups
    ? product.mockups.map((src, i) => ({
        src: gallerySrcs[i] ?? galleryImageUrl(src, 1000),
        thumb: galleryThumbs[i] ?? thumbImageUrl(src),
        label: i === 0 ? "Main" : `View ${i + 1}`,
        frame: "bg-blush",
        transform: "",
      }))
    : syntheticViews.map((v, i) => ({
        src: gallerySrcs[i] ?? galleryImageUrl(product.image, 1000),
        thumb: galleryThumbs[i] ?? thumbImageUrl(product.image),
        ...v,
      }));

  const onAdd = () => {
    for (let i = 0; i < qty; i++) addToCart(product);

  };

  return (
    <div className="mx-auto max-w-7xl px-6 lg:px-10 py-10 lg:py-14">
      <button
        onClick={() => router.history.back()}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-8"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <GalleryImageBudget
        urls={gallery.map((v) => v.src)}
        activeIndex={Math.min(activeView, gallery.length - 1)}
      />

      <div className="grid lg:grid-cols-2 gap-10 lg:gap-16">
        {/* Gallery */}
        <div>
          <ProductMorphGallery
            views={gallery}
            alt={product.name}
            activeIndex={Math.min(activeView, gallery.length - 1)}
            onChange={setActiveView}
          />

          {gallery.length > 1 && (
            <div className={`mt-4 grid gap-3 ${gallery.length <= 4 ? "grid-cols-4" : "grid-cols-6"}`}>
              {gallery.map((v, i) => (
                <button
                  key={i}
                  onClick={() => setActiveView(i)}
                  className={`relative aspect-square rounded-2xl overflow-hidden ${v.frame} border-2 transition-all ${
                    activeView === i ? "border-primary shadow-soft" : "border-transparent opacity-70 hover:opacity-100"
                  }`}
                  aria-label={`View ${v.label}`}
                >
                  <img
                    src={v.thumb}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    width={160}
                    height={160}
                    className={`w-full h-full object-contain ${v.transform}`}
                  />
                </button>
              ))}
            </div>
          )}
        </div>


        {/* Details */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col"
        >
          <span className="text-xs uppercase tracking-[0.3em] text-primary">
            {product.category}
          </span>
          <h1 className="font-serif text-4xl lg:text-5xl mt-3 leading-tight">
            {product.name}
          </h1>
          <div className="mt-4 flex items-baseline gap-3">
            <span className="text-3xl font-medium text-primary">
              ₹{product.price}
            </span>
            <span className="text-sm text-muted-foreground">INR · Free petal-wrapped shipping</span>
          </div>

          <div className="mt-8 h-px bg-border/70" />

          <div className="mt-8">
            <div className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground mb-3">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              About this piece
            </div>
            <p className="text-foreground/80 leading-relaxed">{description}</p>
          </div>

          <ul className="mt-6 grid grid-cols-2 gap-3 text-sm text-foreground/75">
            {(product.features && product.features.length > 0
              ? product.features
              : ["Hand-finished detail", "Rose-gold accents", "Sakura-soft palette", "Ships in 2–7 days"]
            ).map((f, i) => (
              <li key={i} className="rounded-2xl bg-blush/60 px-4 py-3">
                {f}
              </li>
            ))}
          </ul>

          <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <div className="inline-flex shrink-0 items-center rounded-full border border-border/70 bg-card">
                <button
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  className="p-3 hover:text-primary transition-colors"
                  aria-label="Decrease"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-8 text-center font-medium">{qty}</span>
                <button
                  onClick={() => setQty((q) => q + 1)}
                  className="p-3 hover:text-primary transition-colors"
                  aria-label="Increase"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="ml-auto flex shrink-0 items-center gap-3 sm:hidden">
                <WishlistButton productId={product.id} productName={product.name} size="lg" />
                <CompareButton productId={product.id} productName={product.name} size="lg" />
              </div>
            </div>
            <button
              onClick={onAdd}
              className="min-w-0 flex-1 rounded-full bg-primary px-6 py-4 text-primary-foreground font-medium tracking-wide shadow-soft hover:shadow-petal transition-all inline-flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <ShoppingBag className="w-4 h-4 shrink-0" />
              <span className="truncate">Add to Cart · ₹{(product.price * qty).toFixed(2)}</span>
            </button>
            <div className="hidden shrink-0 items-center gap-3 sm:flex">
              <WishlistButton productId={product.id} productName={product.name} size="lg" />
              <CompareButton productId={product.id} productName={product.name} size="lg" />
            </div>
          </div>


        </motion.div>
      </div>

      <ProductReviews productId={product.id} />
    </div>
  );
}

/**
 * Keeps the gallery honest with the rolling image budget: the active image plus at most
 * one neighbour each way is preloaded, and every reference is released when the shopper
 * leaves the product page.
 */
function GalleryImageBudget({ urls, activeIndex }: { urls: string[]; activeIndex: number }) {
  const active = urls[activeIndex];
  const neighbours = useMemo(
    () => [urls[activeIndex + 1], urls[activeIndex - 1]].filter(Boolean) as string[],
    [urls, activeIndex],
  );

  useEffect(() => {
    if (!active) return;
    imageBudget.retain(active);
    imageBudget.setVisible(active, true);
    return () => {
      imageBudget.setVisible(active, false);
      imageBudget.release(active);
    };
  }, [active]);

  useEffect(() => {
    if (!neighbours.length) return;
    const t = window.setTimeout(() => imageBudget.preload(neighbours.slice(0, 2)), 250);
    return () => window.clearTimeout(t);
  }, [neighbours]);

  return null;
}
