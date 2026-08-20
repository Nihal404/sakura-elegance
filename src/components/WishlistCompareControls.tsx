import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Heart, Scale } from "lucide-react";
import { toast } from "sonner";
import { useShoppingLists } from "@/lib/shopping-lists";

/**
 * The heart (wishlist) + compare toggles shared by product cards and the product
 * detail page. Purely presentational state comes from ShoppingListsProvider.
 */
export function WishlistButton({
  productId,
  productName,
  size = "sm",
  className = "",
}: {
  productId: string;
  productName?: string;
  size?: "sm" | "lg";
  className?: string;
}) {
  const { isWishlisted, toggleWishlist } = useShoppingLists();
  const active = isWishlisted(productId);
  const dim = size === "lg" ? "w-11 h-11" : "w-9 h-9";
  const icon = size === "lg" ? "w-5 h-5" : "w-4 h-4";
  const [burst, setBurst] = useState(0);

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.86 }}
      animate={burst ? { scale: [1, 1.25, 1] } : {}}
      transition={{ duration: 0.35 }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const wasActive = active;
        toggleWishlist(productId);
        if (!wasActive) setBurst((n) => n + 1);
        toast.success(
          wasActive
            ? `${productName ?? "Piece"} removed from wishlist`
            : `${productName ?? "Piece"} saved for later`,
        );
      }}
      aria-pressed={active}
      aria-label={active ? "Remove from wishlist" : "Save to wishlist"}
      className={`${dim} relative rounded-full flex items-center justify-center backdrop-blur border transition-colors ${
        active
          ? "bg-primary/10 text-red-500 border-red-400/70 shadow-petal"
          : "bg-background/85 text-foreground/70 border-border/60 hover:text-red-500 hover:border-red-400/50"
      } ${className}`}
    >
      <Heart className={`${icon} ${active ? "fill-red-500 text-red-500" : ""}`} />

      {/* Red heart pop on save */}
      <AnimatePresence>
        {burst > 0 && (
          <motion.span
            key={burst}
            initial={{ opacity: 0, scale: 0.4, y: 0 }}
            animate={{ opacity: [0, 1, 1, 0], scale: [0.4, 1.5, 1.7, 1.9], y: -26 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            onAnimationComplete={() => setBurst(0)}
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
          >
            <Heart className={`${icon} fill-red-500 text-red-500 drop-shadow-md`} />
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

export function CompareButton({
  productId,
  productName,
  size = "sm",
  className = "",
}: {
  productId: string;
  productName?: string;
  size?: "sm" | "lg";
  className?: string;
}) {
  const { isComparing, toggleCompare, compareLimit } = useShoppingLists();
  const active = isComparing(productId);
  const dim = size === "lg" ? "w-11 h-11" : "w-9 h-9";
  const icon = size === "lg" ? "w-5 h-5" : "w-4 h-4";

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.86 }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const ok = toggleCompare(productId);
        if (!ok) {
          toast.error(`You can compare up to ${compareLimit} pieces. Remove one first.`);
          return;
        }
        toast.success(
          active
            ? `${productName ?? "Piece"} removed from compare`
            : `${productName ?? "Piece"} added to compare`,
        );
      }}
      aria-pressed={active}
      aria-label={active ? "Remove from comparison" : "Add to comparison"}
      className={`${dim} rounded-full flex items-center justify-center backdrop-blur border transition-colors ${
        active
          ? "bg-foreground text-background border-foreground shadow-soft"
          : "bg-background/85 text-foreground/70 border-border/60 hover:text-primary hover:border-primary/50"
      } ${className}`}
    >
      <Scale className={icon} />
    </motion.button>
  );
}
