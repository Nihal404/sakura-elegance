import { motion, AnimatePresence } from "framer-motion";
import { X, Minus, Plus, ShoppingBag } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useStore } from "@/lib/store";

export function CartDrawer() {
  const { cart, cartOpen, setCartOpen, updateQty, removeFromCart, cartTotal } = useStore();

  return (
    <AnimatePresence>
      {cartOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-foreground/30 backdrop-blur-sm z-[60]"
            onClick={() => setCartOpen(false)}
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 260 }}
            className="fixed right-0 top-0 h-full w-full sm:w-[420px] bg-background z-[70] shadow-petal flex flex-col"
          >
            <div className="flex items-center justify-between px-6 py-5 border-b border-border">
              <h3 className="font-serif text-2xl">Your Bag</h3>
              <button onClick={() => setCartOpen(false)} className="p-2 rounded-full hover:bg-blush">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center gap-4 text-muted-foreground">
                  <div className="w-20 h-20 rounded-full bg-blush flex items-center justify-center">
                    <ShoppingBag className="w-8 h-8 text-primary" />
                  </div>
                  <p>Your bag is empty. Let elegance bloom.</p>
                </div>
              ) : (
                <ul className="space-y-4">
                  {cart.map((item) => (
                    <motion.li
                      key={item.id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="flex gap-4 p-3 rounded-2xl bg-blush/60"
                    >
                      <img src={item.image} alt={item.name} className="w-20 h-24 rounded-xl object-cover" />
                      <div className="flex-1 flex flex-col">
                        <div className="flex justify-between gap-2">
                          <div>
                            <p className="font-medium leading-tight">{item.name}</p>
                            <p className="text-xs text-muted-foreground">{item.category}</p>
                          </div>
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="mt-auto flex items-center justify-between">
                          <div className="flex items-center gap-2 bg-background rounded-full px-1 py-1">
                            <button
                              onClick={() => updateQty(item.id, item.qty - 1)}
                              className="w-7 h-7 rounded-full hover:bg-sakura/40 flex items-center justify-center"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="text-sm w-6 text-center">{item.qty}</span>
                            <button
                              onClick={() => updateQty(item.id, item.qty + 1)}
                              className="w-7 h-7 rounded-full hover:bg-sakura/40 flex items-center justify-center"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                          <span className="font-semibold">₹{(item.qty * item.price).toFixed(2)}</span>
                        </div>
                      </div>
                    </motion.li>
                  ))}
                </ul>
              )}
            </div>

            <div className="border-t border-border p-6 space-y-4">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Subtotal</span>
                <span>₹{cartTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lg font-semibold">
                <span>Total</span>
                <span className="text-gradient-rose">₹{cartTotal.toFixed(2)}</span>
              </div>
              <Link
                to="/cart"
                onClick={() => setCartOpen(false)}
                aria-disabled={cart.length === 0}
                className={`block text-center w-full py-3.5 rounded-full bg-primary text-primary-foreground font-medium tracking-wide hover:opacity-90 transition-all shadow-soft ${cart.length === 0 ? "pointer-events-none opacity-40" : ""}`}
              >
                View Bag & Checkout
              </Link>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
