import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { Minus, Plus, X, ShoppingBag, ArrowLeft, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { SizedImg } from "@/components/SizedImg";
import { useStore } from "@/lib/store";
import { playDelightedSound } from "@/lib/zari/sound";

// TODO: Replace with the merchant's WhatsApp number in international format
// (digits only, with country code, no "+" or spaces). Example: 919876543210
const WHATSAPP_NUMBER = "919972025151";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { title: "Your Bag — Zari Boutique" },
      { name: "description", content: "Review the pieces in your bag and check out via WhatsApp." },
      { property: "og:title", content: "Your Bag — Zari Boutique" },
      { property: "og:description", content: "Review your Sakura-curated selections before checkout." },
    ],
  }),
  component: CartPage,
});

function CartPage() {
  const { cart, updateQty, removeFromCart, cartTotal, cartCount, user, placeOrder } =
    useStore();
  const router = useRouter();
  const [popup, setPopup] = useState(false);

  const [placing, setPlacing] = useState(false);

  const handleBuyNow = async () => {
    if (cart.length === 0 || placing) return;
    if (!user) {
      router.navigate({ to: "/login", search: { next: "/cart" } });
      return;
    }

    playDelightedSound();

    // Snapshot the bag: placing the order clears it server-side.
    const lines = cart.map(
      (i, idx) =>
        `${idx + 1}. ${i.name} (${i.category}) — Qty: ${i.qty} × ₹${i.price.toFixed(2)} = ₹${(
          i.qty * i.price
        ).toFixed(2)}`,
    );
    const total = cartTotal;

    setPlacing(true);
    let orderId: string;
    try {
      // The order (and its authoritative total) is recorded in the database first,
      // so WhatsApp is a confirmation channel, not the source of truth.
      orderId = await placeOrder();
    } catch (err: unknown) {
      setPlacing(false);
      toast.error(err instanceof Error ? err.message : "Could not place your order.");
      return;
    }
    setPlacing(false);
    setPopup(true);

    const body =
      `Hello Zari Boutique 🌸\n\nI would like to order:\n\n` +
      lines.join("\n") +
      `\n\n*Total: ₹${total.toFixed(2)}*\nOrder ref: ${orderId.slice(0, 8).toUpperCase()}` +
      `\n\nPlease confirm availability and next steps.`;
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(body)}`;

    setTimeout(() => {
      window.open(url, "_blank");
      setPopup(false);
    }, 1800);
  };

  return (
    <div className="min-h-screen bg-sakura-gradient">
      <div className="mx-auto max-w-5xl px-6 lg:px-10 py-12">
        <button
          onClick={() => router.history.back()}
          className="inline-flex items-center gap-2 text-sm text-foreground/70 hover:text-primary transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Continue shopping
        </button>

        <div className="flex items-end justify-between mb-10">
          <div>
            <p className="text-xs tracking-[0.3em] text-primary/80 uppercase">Your Bag</p>
            <h1 className="font-serif text-4xl md:text-5xl mt-2">
              <span className="text-gradient-rose">Blooming</span> selections
            </h1>
          </div>
          <span className="text-sm text-muted-foreground">{cartCount} item{cartCount === 1 ? "" : "s"}</span>
        </div>

        {cart.length === 0 ? (
          <div className="rounded-3xl bg-background/70 backdrop-blur border border-border p-16 text-center flex flex-col items-center gap-5">
            <div className="w-24 h-24 rounded-full bg-blush flex items-center justify-center">
              <ShoppingBag className="w-10 h-10 text-primary" />
            </div>
            <div>
              <h2 className="font-serif text-2xl">Your bag is empty</h2>
              <p className="text-sm text-muted-foreground mt-2">
                Let elegance bloom — explore the collection.
              </p>
            </div>
            <Link
              to="/shop"
              className="mt-2 inline-flex rounded-full bg-primary text-primary-foreground px-6 py-3 text-sm font-medium shadow-soft hover:opacity-90 transition"
            >
              Browse the shop
            </Link>
          </div>
        ) : (
          <div className="grid lg:grid-cols-[1fr_360px] gap-8">
            <ul className="space-y-4">
              {cart.map((item) => (
                <li
                  key={item.id}
                  className="flex gap-5 p-4 rounded-2xl bg-background/95 border border-border shadow-soft animate-fade-in"
                >
                  <Link
                    to="/product/$id"
                    params={{ id: item.id }}
                    className="shrink-0"
                  >
                    <SizedImg
                      raw={item.image}
                      spec={{ width: 200, quality: 65, ladder: [160, 240, 320] }}
                      alt={item.name}
                      loading="lazy"
                      decoding="async"
                      width={128}
                      height={144}
                      className="w-28 h-32 md:w-32 md:h-36 rounded-xl object-cover"
                    />
                  </Link>
                  <div className="flex-1 min-w-0 flex flex-col">
                    <div className="flex justify-between gap-2">
                      <div className="min-w-0">
                        <Link
                          to="/product/$id"
                          params={{ id: item.id }}
                          className="block truncate font-serif text-lg md:text-xl leading-tight hover:text-primary transition-colors"
                        >
                          {item.name}
                        </Link>
                        <p className="text-xs tracking-wide text-muted-foreground uppercase mt-1">
                          {item.category}
                        </p>
                        <p className="text-sm text-foreground/70 mt-2">
                          ₹{item.price.toFixed(2)} each
                        </p>
                      </div>
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="shrink-0 text-muted-foreground hover:text-destructive p-1"
                        aria-label={`Remove ${item.name} from bag`}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-2 pt-3">
                      <div className="flex shrink-0 items-center gap-1 bg-blush/60 rounded-full px-1 py-1">
                        <button
                          onClick={() => updateQty(item.id, item.qty - 1)}
                          aria-label={`Decrease quantity of ${item.name}`}
                          className="w-8 h-8 rounded-full hover:bg-background flex items-center justify-center"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-sm w-7 text-center font-medium">{item.qty}</span>
                        <button
                          onClick={() => updateQty(item.id, item.qty + 1)}
                          aria-label={`Increase quantity of ${item.name}`}
                          className="w-8 h-8 rounded-full hover:bg-background flex items-center justify-center"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <span className="ml-auto font-serif text-base sm:text-lg whitespace-nowrap tabular-nums">
                        ₹{(item.qty * item.price).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <aside className="h-fit rounded-3xl bg-background/95 border border-border shadow-petal p-6 lg:sticky lg:top-28">
              {/* Step rail */}
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em]">
                {(["bag", "checkout"] as const).map((s, i) => {
                  const active = step === s;
                  const done = step === "checkout" && s === "bag";
                  return (
                    <div key={s} className="flex flex-1 items-center gap-2">
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
                          active || done
                            ? "bg-primary text-primary-foreground"
                            : "bg-blush text-primary/70"
                        }`}
                      >
                        {done ? <Check className="h-3 w-3" /> : i + 1}
                      </span>
                      <span className={active ? "text-primary" : "text-muted-foreground"}>
                        {s === "bag" ? "Bag" : "Checkout"}
                      </span>
                    </div>
                  );
                })}
              </div>

              <h2 className="mt-5 font-serif text-2xl">Order Summary</h2>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>
                    Items ({cartCount})
                  </span>
                  <span className="tabular-nums">₹{cartTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Shipping</span>
                  <span>{freeShipping ? "Free" : "Confirmed on WhatsApp"}</span>
                </div>
                {!freeShipping && (
                  <p className="text-[11px] text-primary/80">
                    Add ₹{(FREE_SHIPPING_THRESHOLD - cartTotal).toFixed(0)} more for free shipping.
                  </p>
                )}
                <div className="border-t border-border pt-3 flex justify-between text-lg font-semibold">
                  <span>Total</span>
                  <span className="text-gradient-rose tabular-nums">₹{cartTotal.toFixed(2)}</span>
                </div>
              </div>

              {step === "bag" ? (
                <>
                  <button
                    onClick={() => setStep("checkout")}
                    className="mt-6 w-full py-3.5 rounded-full bg-primary text-primary-foreground font-medium tracking-wide hover:opacity-90 transition-all shadow-soft"
                  >
                    Proceed to checkout
                  </button>
                  <p className="text-[11px] text-muted-foreground text-center mt-3">
                    One quick step — delivery details, then confirm on WhatsApp.
                  </p>
                </>
              ) : (
                <div className="mt-6 space-y-3">
                  <label className="block text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Delivery address
                  </label>
                  <textarea
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    rows={3}
                    placeholder="Flat / street, city, state, PIN"
                    className="w-full resize-none rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary/60"
                  />
                  <button
                    onClick={handleBuyNow}
                    disabled={placing || address.trim().length < 8}
                    className="w-full py-3.5 rounded-full bg-primary text-primary-foreground font-medium tracking-wide hover:opacity-90 transition-all shadow-soft disabled:opacity-60"
                  >
                    {placing ? "Placing your order…" : "Confirm order on WhatsApp"}
                  </button>
                  <button
                    onClick={() => setStep("bag")}
                    className="w-full py-2 text-xs text-muted-foreground hover:text-primary transition-colors"
                  >
                    Back to bag
                  </button>
                  <p className="text-[11px] text-muted-foreground text-center">
                    You'll be redirected to WhatsApp with your order details prefilled.
                  </p>
                </div>
              )}
            </aside>
          </div>
        )}
      </div>

      <AnimatePresence>
        {popup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-foreground/70 px-6 text-center"
          >
            <motion.div
              initial={{ scale: 0.6, opacity: 0, rotate: -6 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={{ scale: 1.15, opacity: 0 }}
              transition={{ type: "spring", damping: 12, stiffness: 180 }}
              className="relative flex flex-col items-center justify-center"
            >
              <motion.span
                animate={{
                  backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
                }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                className="block font-zari text-6xl sm:text-7xl md:text-9xl font-bold tracking-widest text-center mx-auto"
                style={{
                  backgroundImage:
                    "linear-gradient(90deg, #b8860b, #ffd700, #fff4b8, #ffd700, #b8860b)",
                  backgroundSize: "200% 100%",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                  textShadow: "0 0 40px rgba(255, 215, 0, 0.35)",
                }}
              >
                ZARI
              </motion.span>
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-center text-sm tracking-[0.4em] uppercase mt-4 text-white/90"
              >
                Taking you to WhatsApp
              </motion.p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
