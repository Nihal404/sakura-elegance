import { memo } from "react";
import { motion } from "framer-motion";
import { Eye } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { type Product } from "@/lib/store";
import { ProductImage } from "@/components/ProductImage";
import { CARD_SIZES, CARD_WIDTHS, cardImageUrl, cardSrcSet } from "@/lib/zari/image-url";
import { CompareButton, WishlistButton } from "@/components/WishlistCompareControls";


/**
 * Grid card. Loads ONLY the product's primary thumbnail (a ~320–500px CDN variant) —
 * never the 1 MB original, and never the gallery/mockup images, which are fetched on the
 * product detail page.
 */
export const ProductCard = memo(function ProductCard({
  product,
  index = 0,
  priority = false,
}: {
  product: Product;
  index?: number;
  priority?: boolean;
}) {
  const thumb = cardImageUrl(product.image, 400);


  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, delay: Math.min(index, 6) * 0.05, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -8, scale: 1.015 }}
      whileTap={{ y: -2, scale: 0.965 }}
      onTapStart={(event) => {
        // Press origin follows the finger/cursor for a tactile squash.
        const el = event.currentTarget as HTMLElement | null;
        if (!el || typeof el.getBoundingClientRect !== "function") return;
        const point = event as unknown as { clientX?: number; clientY?: number };
        if (point.clientX == null || point.clientY == null) return;
        const r = el.getBoundingClientRect();
        const x = Math.min(100, Math.max(0, ((point.clientX - r.left) / r.width) * 100));
        const y = Math.min(100, Math.max(0, ((point.clientY - r.top) / r.height) * 100));
        el.style.transformOrigin = `${x}% ${y}%`;
      }}
      style={{ WebkitTapHighlightColor: "transparent" }}
      className="group relative rounded-3xl overflow-hidden bg-card shadow-soft transition-shadow duration-500 hover:shadow-petal active:shadow-soft cursor-pointer select-none"

    >
      <Link
        to="/product/$id"
        params={{ id: product.id }}
        className="block outline-none focus-visible:ring-2 focus-visible:ring-primary/60 rounded-3xl"
        aria-label={`View ${product.name}`}
      >

        {/* Fixed aspect ratio + intrinsic size = no layout shift while images stream in. */}
        <div className="relative aspect-[3/4] overflow-hidden bg-blush">
          <ProductImage
            src={thumb}
            rawSrc={product.image}
            variant={{ width: 400, quality: 70, ladder: CARD_WIDTHS }}
            srcSet={cardSrcSet(product.image)}
            sizes={CARD_SIZES}
            alt={product.name}
            width={400}
            height={533}
            eager={priority}
            fetchPriority={priority ? "high" : undefined}
            className="w-full h-full object-cover group-hover:scale-[1.06] group-active:scale-[1.02] transition-transform duration-700 ease-out"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-foreground/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
          {/* Press wash: instant visual confirmation the card was tapped. */}
          <div className="absolute inset-0 bg-foreground/10 opacity-0 group-active:opacity-100 transition-opacity duration-150 pointer-events-none" />

          <div className="absolute top-3 right-3 flex flex-col gap-2">
            <WishlistButton productId={product.id} productName={product.name} />
            <CompareButton productId={product.id} productName={product.name} />
          </div>

          {/* Cards never add to cart directly — they lead to the product page. */}
          <span className="absolute bottom-4 left-4 right-4 py-3 rounded-full bg-background/95 backdrop-blur text-foreground font-medium text-sm tracking-wide flex items-center justify-center gap-2 opacity-0 translate-y-3 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-500">
            <Eye className="w-4 h-4" />
            View Details
          </span>
          <span className="absolute top-4 left-4 text-[10px] uppercase tracking-[0.15em] px-3 py-1 rounded-full bg-background/85 backdrop-blur text-foreground/80">
            {product.category}
          </span>
        </div>
        <div className="p-5 flex items-center justify-between">
          <div>
            <h3 className="font-serif text-lg leading-tight">{product.name}</h3>
          </div>
          <span className="font-medium text-primary">₹{product.price}</span>
        </div>
      </Link>
    </motion.div>
  );
});
