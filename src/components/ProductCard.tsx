import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useStore, type Product } from "@/lib/store";

export function ProductCard({ product, index = 0 }: { product: Product; index?: number }) {
  const { addToCart, setCartOpen } = useStore();

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, delay: index * 0.06, ease: "easeOut" }}
      whileHover={{ y: -6 }}
      className="group relative rounded-3xl overflow-hidden bg-card shadow-soft"
    >
      <Link
        to="/product/$id"
        params={{ id: product.id }}
        className="block"
        aria-label={`View ${product.name}`}
      >
        <div className="relative aspect-[3/4] overflow-hidden bg-blush">
          <motion.img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover"
            whileHover={{ scale: 1.08 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-foreground/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <motion.button
            initial={false}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              addToCart(product);
              setCartOpen(true);
            }}
            className="absolute bottom-4 left-4 right-4 py-3 rounded-full bg-background/95 backdrop-blur text-foreground font-medium text-sm tracking-wide flex items-center justify-center gap-2 opacity-0 translate-y-3 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-500 hover:bg-primary hover:text-primary-foreground"
          >
            <Plus className="w-4 h-4" />
            Add to Cart
          </motion.button>
          <span className="absolute top-4 left-4 text-[10px] uppercase tracking-[0.15em] px-3 py-1 rounded-full bg-background/85 backdrop-blur text-foreground/80">
            {product.category}
          </span>
        </div>
        <div className="p-5 flex items-center justify-between">
          <div>
            <h3 className="font-serif text-lg leading-tight">{product.name}</h3>
          </div>
          <span className="font-medium text-primary">${product.price}</span>
        </div>
      </Link>
    </motion.div>
  );
}
