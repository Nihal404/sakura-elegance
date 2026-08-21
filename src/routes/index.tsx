import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion, type Variants } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { useStore } from "@/lib/store";
import { ProductGridSkeleton } from "@/components/ProductCardSkeleton";
import { DepthCarousel } from "@/components/DepthCarousel";
import { BannerSlider } from "@/components/BannerSlider";
import { cardImageUrl, DETAIL_WIDTHS } from "@/lib/zari/image-url";

import { buildProductMockSlides } from "@/lib/zari/product-mock-slides";
import { fetchBanners, type Banner } from "@/lib/zari/banners";
import { useSizedSrcList } from "@/hooks/useSizedImage";

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

const BANNER_SPEC = { width: 1000, quality: 78 } as const;

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
  // Hero product mock images — edit PRODUCT_MOCK_SLIDES in
  // src/lib/zari/product-mock-slides.ts to change them.
  const fallbackSlides = useMemo(() => buildProductMockSlides(products as any, 5), [products]);
  // Custom banners uploaded from the admin dashboard win over the fallback slides.
  const [banners, setBanners] = useState<Banner[]>([]);
  useEffect(() => {
    let alive = true;
    fetchBanners(true)
      .then((rows) => {
        if (alive) setBanners(rows);
      })
      .catch(() => {
        /* fall back to the curated slides */
      });
    return () => {
      alive = false;
    };
  }, []);
  const rawSlides = useMemo(
    () =>
      banners.length
        ? banners.map((b) => ({ image: b.image, caption: b.caption ?? "" }))
        : fallbackSlides,
    [banners, fallbackSlides],
  );
  // Private-bucket banners must be resolved to a signed, right-sized variant before the
  // WebGL slider can load them as textures.
  const resolved = useSizedSrcList(
    useMemo(() => rawSlides.map((s) => s.image), [rawSlides]),
    BANNER_SPEC,
  );
  const mockSlides = useMemo(
    () => rawSlides.map((s, i) => ({ ...s, image: resolved[i] || s.image })),
    [rawSlides, resolved],
  );

  return (
    <div>
      {/* BANNER — 4:3 ad / campaign showcase */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-sakura-gradient" />
        <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-10 pt-6 pb-4">
          <h1 className="sr-only">
            Zari Boutique — Sakura clothing &amp; accessories
          </h1>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="rounded-[1.75rem] overflow-hidden shadow-petal"
          >
            {/* BANNER SLIDES — edit PRODUCT_MOCK_SLIDES in
                src/lib/zari/product-mock-slides.ts to change them. */}
            <MorphSlider
              items={mockSlides}
              transition="melt"
              fit="contain"
              intensity={0.35}
              aberration={0.35}
              drift={0.4}
              autoplay
              autoplayDelay={4}
              loop
              showCaptions
              showControls
              showIndicators
              radius={28}
              aspect={4 / 3}
            />
          </motion.div>

          {/* OFFERS STRIP */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="mt-4 rounded-2xl border border-primary/20 bg-background/80 backdrop-blur px-5 py-3.5 flex items-center gap-3 shadow-soft"
          >
            <span className="inline-flex items-center gap-1.5 shrink-0 text-[0.65rem] uppercase tracking-[0.2em] text-primary">
              <Sparkles className="w-3.5 h-3.5" />
              Offers
            </span>
            <p className="text-sm text-foreground/80 truncate">
              Spring '26 Edit — flat 15% off silks &amp; free shipping above ₹2,999
            </p>
          </motion.div>

          {/* CATEGORY CARDS */}
          <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4">
            {[
              {
                title: "Clothes",
                caption: "Silks, chiffons & couture",
                image:
                  "https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=1200&q=80",
                category: "Clothing" as const,
              },
              {
                title: "Accessories",
                caption: "Rose gold, pearls & charms",
                image:
                  "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=1200&q=80",
                category: "Accessories" as const,
              },
            ].map((c, i) => (
              <motion.div
                key={c.title}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 + i * 0.1 }}
              >
                <Link
                  to="/shop"
                  search={{ category: c.category } as any}
                  className="group relative block rounded-[1.5rem] overflow-hidden aspect-square shadow-soft"
                >
                  <motion.img
                    src={c.image}
                    alt={c.title}
                    className="w-full h-full object-cover"
                    whileHover={{ scale: 1.06 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-foreground/65 via-foreground/10 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5 text-primary-foreground">
                    <h2 className="font-serif text-2xl sm:text-3xl text-white">{c.title}</h2>
                    <p className="mt-1 text-[0.7rem] sm:text-xs opacity-90 text-white truncate">
                      {c.caption}
                    </p>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>

          {/* EXPLORE */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-5 flex justify-center"
          >
            <Link
              to="/shop"
              className="group inline-flex w-full sm:w-auto justify-center items-center gap-2 px-10 py-4 rounded-full bg-primary text-primary-foreground font-medium tracking-wide shadow-soft hover:shadow-petal transition-all"
            >
              Explore
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </motion.div>
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
        ) : featured.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-16">
            New blooms are on their way — check back soon.
          </p>
        ) : (
          <DepthCarousel
            items={featured.map((p: any) => ({
              ...p,
              // Carousel cards are 320px wide — serve a 640px variant, not the original.
              image: cardImageUrl(p.image, 640),
              alt: `${p.name} — Zari Boutique ${p.category ?? "product"}`,
            }))}
            cardWidth={320}
            cardHeight={420}
            depth={200}
            spread={75}
            tilt={20}
            perspective={1300}
            falloff={0.2}
            blur={5}
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
