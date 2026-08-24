import { memo } from "react";
import { motion } from "framer-motion";
import { ShoppingBag } from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { type Product } from "@/lib/store";
import { ProductImage } from "@/components/ProductImage";
import { CARD_SIZES, CARD_WIDTHS, cardImageUrl, cardSrcSet } from "@/lib/zari/image-url";
import { WishlistButton } from "@/components/WishlistCompareControls";


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
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, delay: Math.min(index, 6) * 0.05, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -6 }}
      whileTap={{ scale: 0.975 }}
      style={{ WebkitTapHighlightColor: "transparent" }}
      className="group relative rounded-[1.75rem] p-2 border border-primary/25 bg-card shadow-soft transition-shadow duration-500 hover:shadow-petal cursor-pointer select-none"
    >
      <Link
        to="/product/$id"
        params={{ id: product.id }}
        className="block outline-none focus-visible:ring-2 focus-visible:ring-primary/60 rounded-[1.5rem]"
        aria-label={`View ${product.name}`}
      >
        {/* Framed image window — heart top-left, bag top-right (as sketched). */}
        <div className="relative aspect-[3/4] overflow-hidden rounded-[1.35rem] border border-primary/20 bg-blush">
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
            className="w-full h-full object-cover group-hover:scale-[1.05] transition-transform duration-700 ease-out"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-foreground/25 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
          <div className="absolute inset-0 bg-foreground/10 opacity-0 group-active:opacity-100 transition-opacity duration-150 pointer-events-none" />

          <div className="absolute top-2.5 left-2.5">
            <WishlistButton productId={product.id} productName={product.name} />
          </div>

          {/* Bag icon opens the product page (cards never add to cart directly). */}
          <motion.button
            type="button"
            whileTap={{ scale: 0.86 }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              navigate({ to: "/product/$id", params: { id: product.id } });
            }}
            aria-label={`Open ${product.name} to add to bag`}
            className="absolute top-2.5 right-2.5 w-9 h-9 rounded-full flex items-center justify-center backdrop-blur border border-border/60 bg-background/85 text-foreground/70 hover:text-primary hover:border-primary/50 transition-colors"
          >
            <ShoppingBag className="w-4 h-4" />
          </motion.button>
        </div>

        {/* Footer: name on the left, price boxed on the right. */}
        <div className="mt-2 flex items-end justify-between gap-3 rounded-[1.25rem] border border-primary/20 px-3.5 py-3">
          <h3 className="font-serif text-base sm:text-lg leading-tight border-b border-primary/25 pb-1 flex-1 min-w-0 truncate">
            {product.name}
          </h3>
          <span className="shrink-0 rounded-xl border border-primary/30 bg-blush/50 px-3 py-1.5 text-sm font-medium text-primary">
            ₹{product.price}
          </span>
        </div>
      </Link>
    </motion.div>
  );
});

