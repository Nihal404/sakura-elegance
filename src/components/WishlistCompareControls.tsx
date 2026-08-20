import { motion } from "framer-motion";
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

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.86 }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleWishlist(productId);
        toast.success(
          active
            ? `${productName ?? "Piece"} removed from wishlist`
            : `${productName ?? "Piece"} saved for later`,
        );
      }}
      aria-pressed={active}
      aria-label={active ? "Remove from wishlist" : "Save to wishlist"}
      className={`${dim} rounded-full flex items-center justify-center backdrop-blur border transition-colors ${
        active
          ? "bg-primary text-primary-foreground border-primary shadow-petal"
          : "bg-background/85 text-foreground/70 border-border/60 hover:text-primary hover:border-primary/50"
      } ${className}`}
    >
      <Heart className={`${icon} ${active ? "fill-current" : ""}`} />
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
