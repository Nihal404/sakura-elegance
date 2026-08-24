import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Heart, Loader2, Sparkles } from "lucide-react";
import { useShoppingLists } from "@/lib/shopping-lists";
import { useProductsByIds } from "@/hooks/useProductsByIds";
import { ProductCard } from "@/components/ProductCard";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/wishlist")({
  head: () => ({
    meta: [
      { title: "My Wishlist — Zari Boutique" },
      {
        name: "description",
        content:
          "Your saved Zari Boutique pieces, kept in one place. Revisit the clothing and accessories you love and add them to your bag when you're ready.",
      },
      { property: "og:title", content: "My Wishlist — Zari Boutique" },
      {
        property: "og:description",
        content: "Revisit the Zari Boutique pieces you saved for later.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: WishlistPage,
});

function WishlistPage() {
  const { wishlist, wishlistLoading, hydrated, removeFromWishlist } = useShoppingLists();
  const { items, loading } = useProductsByIds(wishlist);
  const { user } = useStore();

  const showLoading = !hydrated || wishlistLoading || (loading && !items.some((i) => i.product));

  return (
    <div className="mx-auto max-w-7xl px-6 lg:px-10 py-12 lg:py-16">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-primary">
          <Sparkles className="w-3.5 h-3.5" />
          Saved for later
        </span>
        <h1 className="font-serif text-4xl lg:text-5xl mt-3">My Wishlist</h1>
        <p className="mt-3 text-muted-foreground">
          {user
            ? "Your wishlist follows your account across every device."
            : "Saved on this device. Sign in to keep your wishlist across devices."}
        </p>
      </motion.div>

      <div className="mt-10">
        {showLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-3xl overflow-hidden bg-card shadow-soft">
                <div className="aspect-[3/4] bg-sakura-gradient animate-pulse" />
                <div className="p-5 space-y-2">
                  <div className="h-4 w-2/3 rounded-full bg-primary/10 animate-pulse" />
                  <div className="h-3 w-1/3 rounded-full bg-primary/10 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : wishlist.length === 0 ? (
          <EmptyWishlist />
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
            {items.map(({ id, product }, i) =>
              product ? (
                <ProductCard key={id} product={product} index={i} priority={i < 4} />
              ) : (
                <UnavailableCard key={id} onRemove={() => removeFromWishlist(id)} />
              ),
            )}
            {loading && (
              <div className="col-span-full flex justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyWishlist() {
  return (
    <div className="rounded-3xl border border-dashed border-border/70 bg-card/60 px-6 py-16 text-center">
      <div className="mx-auto w-14 h-14 rounded-full bg-blush flex items-center justify-center">
        <Heart className="w-6 h-6 text-primary" />
      </div>
      <h2 className="mt-5 font-serif text-2xl">Nothing saved yet</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Tap the heart on any piece to keep it here for later.
      </p>
      <Link
        to="/shop"
        className="mt-6 inline-flex px-6 py-3 rounded-full bg-primary text-primary-foreground shadow-soft hover:shadow-petal transition-all"
      >
        Explore the collection
      </Link>
    </div>
  );
}

export function UnavailableCard({ onRemove }: { onRemove: () => void }) {
  return (
    <div className="rounded-3xl bg-card shadow-soft overflow-hidden flex flex-col">
      <div className="aspect-[3/4] bg-blush/60 flex items-center justify-center text-center px-4">
        <p className="text-sm text-muted-foreground">This piece is no longer available.</p>
      </div>
      <div className="p-5">
        <button type="button" onClick={onRemove} className="text-sm text-primary hover:underline">
          Remove
        </button>
      </div>
    </div>
  );
}
