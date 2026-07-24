import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useState } from "react";
import { ArrowLeft, Plus, Minus, ShoppingBag, Sparkles, Loader2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { ProductReviews } from "@/components/ProductReviews";

export const Route = createFileRoute("/product/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Product · ${params.id.slice(0, 6)} — Zari Boutique` },
      { name: "description", content: "Discover this Zari Boutique piece — details, price, and styling mockups." },
      { property: "og:title", content: "Zari Boutique — Product" },
      { property: "og:description", content: "Elegant clothing and accessories, curated with a Sakura touch." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProductDetail,
});

function ProductDetail() {
  const { id } = Route.useParams();
  const router = useRouter();
  const { products, productsLoading, addToCart, setCartOpen } = useStore();
  const [qty, setQty] = useState(1);
  const [activeView, setActiveView] = useState(0);

  const product = products.find((p) => p.id === id);

  if (productsLoading && !product) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
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
  const gallery = hasMockups
    ? product.mockups.map((src, i) => ({
        src,
        label: i === 0 ? "Main" : `View ${i + 1}`,
        frame: "bg-blush",
        transform: "",
      }))
    : syntheticViews.map((v) => ({ src: product.image, ...v }));

  const currentView = gallery[Math.min(activeView, gallery.length - 1)];

  const onAdd = () => {
    for (let i = 0; i < qty; i++) addToCart(product);
    setCartOpen(true);
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

      <div className="grid lg:grid-cols-2 gap-10 lg:gap-16">
        {/* Gallery */}
        <div>
          <motion.div
            key={activeView}
            initial={{ opacity: 0.4, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className={`relative aspect-[4/5] rounded-3xl overflow-hidden shadow-petal ${currentView.frame}`}
          >
            <img
              src={currentView.src}
              alt={product.name}
              className={`w-full h-full object-cover transition-transform duration-700 ${currentView.transform}`}
            />
            <span className="absolute top-5 left-5 text-[10px] uppercase tracking-[0.2em] px-3 py-1 rounded-full bg-background/85 backdrop-blur text-foreground/80">
              {currentView.label}
            </span>
          </motion.div>

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
                    src={v.src}
                    alt=""
                    className={`w-full h-full object-cover ${v.transform}`}
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

          <div className="mt-10 flex items-center gap-4">
            <div className="inline-flex items-center rounded-full border border-border/70 bg-card">
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
            <button
              onClick={onAdd}
              className="flex-1 py-3.5 rounded-full bg-primary text-primary-foreground font-medium tracking-wide shadow-soft hover:shadow-petal transition-all inline-flex items-center justify-center gap-2"
            >
              <ShoppingBag className="w-4 h-4" />
              Add to Cart · ₹{(product.price * qty).toFixed(2)}
            </button>
          </div>
        </motion.div>
      </div>

      <ProductReviews productId={product.id} />
    </div>
  );
}
