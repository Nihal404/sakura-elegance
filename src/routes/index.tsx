import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion, type Variants } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { useStore } from "@/lib/store";
import { ProductGridSkeleton } from "@/components/ProductCardSkeleton";
import { DepthCarousel } from "@/components/DepthCarousel";
import { MorphSlider } from "@/components/MorphSlider";
import { buildProductMockSlides } from "@/lib/zari/product-mock-slides";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Zari Boutique | Sakura Clothing & Accessories Online" },
      {
        name: "description",
        content:
          "Shop the Sakura collection at Zari Boutique: silk and chiffon silhouettes, rose gold jewellery and pearl accessories, with prices in INR and 2–7 day shipping.",
      },
      { property: "og:title", content: "Zari Boutique | Sakura Clothing & Accessories Online" },
      {
        property: "og:description",
        content:
          "Silks, chiffons and rose gold accessories from the Zari Boutique Sakura collection — shop new Spring '26 arrivals.",
      },
      { property: "og:url", content: "https://zaris-elegance.lovable.app/" },
    ],
    links: [{ rel: "canonical", href: "https://zaris-elegance.lovable.app/" }],
  }),

  component: Home,
});

const float: Variants = {
  animate: {
    y: [0, -14, 0],
    transition: { duration: 6, repeat: Infinity, ease: "easeInOut" as const },
  },
};

function Home() {
  const navigate = useNavigate();
  const { products, productsLoading } = useStore();
  const featured = products.slice(0, 8);

  return (
    <div>
      {/* HERO */}
      <section className="relative overflow-hidden -mt-20 pt-20">
        <div className="absolute inset-0 bg-sakura-gradient" />
        <img
          src="https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=1900&q=80"
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-30 mix-blend-multiply"
        />
        <div className="absolute inset-0 bg-hero-gradient" />

        {/* Floating petals */}
        {[...Array(6)].map((_, i) => (
          <motion.span
            key={i}
            className="absolute w-3 h-3 rounded-full bg-sakura/70 blur-[1px]"
            style={{
              top: `${10 + i * 12}%`,
              left: `${8 + i * 14}%`,
            }}
            animate={{
              y: [0, 20, 0],
              x: [0, 10, 0],
              opacity: [0.5, 1, 0.5],
            }}
            transition={{ duration: 5 + i, repeat: Infinity, ease: "easeInOut", delay: i * 0.4 }}
          />
        ))}

        <div className="relative mx-auto max-w-7xl px-6 lg:px-10 py-24 md:py-36 grid md:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: "easeOut" }}
          >
            <motion.div
              variants={float}
              animate="animate"
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-background/70 backdrop-blur text-xs tracking-[0.2em] uppercase text-primary mb-6 border border-primary/20"
            >
              <Sparkles className="w-3.5 h-3.5" />
              ZARIBOUTIQUE | BLOOMING&nbsp;
            </motion.div>
            <h1 className="font-serif text-5xl md:text-7xl leading-[1.05] tracking-tight text-foreground">
              <span className="block text-2xl md:text-3xl not-italic tracking-[0.12em] uppercase text-foreground/70">
                Zari Boutique
              </span>
              Elegance
              <span className="block italic text-gradient-rose">Blooms Here</span>
            </h1>
            <p className="mt-6 text-base md:text-lg text-foreground/75 max-w-md leading-relaxed">
              Handcrafted silhouettes and heirloom accessories, curated for the modern romantic.
              Bloom in every occasion.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                to="/shop"
                className="group inline-flex items-center gap-2 px-8 py-4 rounded-full bg-primary text-primary-foreground font-medium tracking-wide shadow-soft hover:shadow-petal transition-all"
              >
                Shop the Collection
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                to="/shop"
                search={{ category: "Accessories" } as any}
                className="inline-flex items-center gap-2 px-8 py-4 rounded-full border border-foreground/20 hover:border-primary hover:text-primary font-medium tracking-wide transition-all"
              >
                Explore Accessories
              </Link>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.2 }}
            className="relative hidden md:block"
          >
            <motion.div variants={float} animate="animate" className="relative">
              {/* PRODUCT MOCK SHOWCASE — slides come from
                  src/lib/zari/product-mock-slides.ts (PRODUCT_MOCK_SLIDES) */}
              <MorphSlider
                items={mockSlides}
                transition="melt"
                intensity={0.55}
                aberration={0.35}
                drift={0.4}
                autoplay
                autoplayDelay={4}
                loop
                showCaptions
                showControls
                showIndicators
                radius={40}
                aspect={4 / 5}
                className="shadow-petal"
              />

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="absolute -bottom-6 -left-6 bg-background rounded-2xl shadow-soft p-4 flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-full bg-sakura flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">New Arrivals</p>
                  <p className="text-sm font-medium">Spring '26 Edit</p>
                </div>
              </motion.div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* CATEGORIES */}
      <section className="mx-auto max-w-7xl px-6 lg:px-10 py-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center max-w-2xl mx-auto mb-14"
        >
          <p className="text-xs uppercase tracking-[0.3em] text-primary mb-3">Discover</p>
          <h2 className="font-serif text-4xl md:text-5xl">Two worlds. One aesthetic.</h2>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6">
          {[
            {
              title: "Clothing",
              caption: "Silks, chiffons & couture edits",
              image:
                "https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=1200&q=80",
              category: "Clothing" as const,
            },
            {
              title: "Accessories",
              caption: "Rose gold, pearls & petal charms",
              image:
                "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=1200&q=80",
              category: "Accessories" as const,
            },
          ].map((c, i) => (
            <motion.div
              key={c.title}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: i * 0.15 }}
            >
              <Link
                to="/shop"
                search={{ category: c.category } as any}
                className="group relative block rounded-[2rem] overflow-hidden aspect-[4/5] md:aspect-[5/6] shadow-soft"
              >
                <motion.img
                  src={c.image}
                  alt={c.title}
                  className="w-full h-full object-cover"
                  whileHover={{ scale: 1.06 }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 via-foreground/10 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-8 md:p-10 text-primary-foreground">
                  <p className="text-xs uppercase tracking-[0.25em] opacity-90">Shop</p>
                  <h3 className="font-serif text-4xl md:text-5xl mt-2 text-white">{c.title}</h3>
                  <p className="mt-2 text-sm opacity-90 text-white">{c.caption}</p>
                  <span className="mt-5 inline-flex items-center gap-2 text-sm text-white">
                    Enter collection
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform" />
                  </span>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* FEATURED — depth carousel showcase */}
      <section className="mx-auto max-w-7xl px-6 lg:px-10 pb-24">
        <div className="flex items-end justify-between mb-10">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-primary mb-3">Best sellers</p>
            <h2 className="font-serif text-3xl md:text-5xl">In full bloom</h2>
          </div>
          <Link to="/shop" className="hidden md:inline-flex items-center gap-2 text-sm hover:text-primary">
            View all <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        {productsLoading && featured.length === 0 ? (
          <ProductGridSkeleton count={4} />
        ) : (
          <DepthCarousel
            items={featured}
            cardWidth={350}
            cardHeight={470}
            depth={200}
            spread={78}
            visibleCards={4}
            autoplay
            loop
            controls
            indicators
            onItemClick={(item: { id: string }) =>
              navigate({ to: "/product/$id", params: { id: item.id } })
            }
          />
        )}
      </section>
    </div>
  );
}
