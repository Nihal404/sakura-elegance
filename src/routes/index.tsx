import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion, type Variants } from "framer-motion";
import { ArrowRight, Sparkles, ShieldCheck, Truck, RefreshCw, Gem } from "lucide-react";
import { useStore } from "@/lib/store";
import { ProductGridSkeleton } from "@/components/ProductCardSkeleton";
import { DepthCarousel } from "@/components/DepthCarousel";
import { BannerSlider } from "@/components/BannerSlider";
import { cardImageUrl, DETAIL_WIDTHS } from "@/lib/zari/image-url";
import { buildProductMockSlides } from "@/lib/zari/product-mock-slides";
import { fetchBanners, type Banner } from "@/lib/zari/banners";
import { useSizedSrcList } from "@/hooks/useSizedImage";
import { RecentlyViewedStrip } from "@/components/RecentlyViewedStrip";

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

const BANNER_SPEC = { width: 1000, quality: 78, ladder: DETAIL_WIDTHS } as const;

function Home() {
  const navigate = useNavigate();
  const { products, productsLoading } = useStore();
  const featured = products.slice(0, 8);
  const fallbackSlides = useMemo(() => buildProductMockSlides(products as any, 5), [products]);
  const [banners, setBanners] = useState<Banner[]>([]);

  useEffect(() => {
    let alive = true;
    fetchBanners(true)
      .then((rows) => {
        if (alive) setBanners(rows);
      })
      .catch(() => {});
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

  const resolved = useSizedSrcList(
    useMemo(() => rawSlides.map((s) => s.image), [rawSlides]),
    BANNER_SPEC,
  );
  const mockSlides = useMemo(
    () => rawSlides.map((s, i) => ({ ...s, image: resolved[i] || s.image })),
    [rawSlides, resolved],
  );

  return (
    <div className="space-y-12 md:space-y-16">
      {/* HERO SECTION — Dual-column desktop layout */}
      <section className="relative overflow-hidden pt-4 pb-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            {/* Left Column: Hero Text & CTAs */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, ease: "easeOut" }}
              className="lg:col-span-5 space-y-6 text-center lg:text-left"
            >
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sakura/30 border border-primary/20 backdrop-blur-sm text-xs font-semibold uppercase tracking-wider text-primary shadow-sm">
                <Sparkles className="w-4 h-4 text-gold animate-spin-slow" />
                Spring '26 Sakura Collection
              </div>

              <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground leading-[1.1]">
                Where Timeless <br />
                <span className="text-gradient-rose italic font-light">Elegance Blooms</span>
              </h1>

              <p className="text-muted-foreground text-base sm:text-lg max-w-xl mx-auto lg:mx-0 leading-relaxed font-sans">
                Explore hand-crafted silk couture, delicate chiffon silhouettes, and rose gold pearl
                jewellery curated for the modern romantic.
              </p>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-2">
                <Link
                  to="/shop"
                  className="group inline-flex w-full sm:w-auto items-center justify-center gap-3 px-8 py-3.5 rounded-full bg-primary text-primary-foreground font-semibold shadow-soft hover:shadow-petal hover:scale-[1.02] transition-all duration-300"
                >
                  Explore Collection
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link
                  to="/shop"
                  search={{ category: "Clothing" } as any}
                  className="inline-flex w-full sm:w-auto items-center justify-center px-7 py-3.5 rounded-full border border-border/80 bg-background/60 hover:bg-sakura/20 text-foreground font-medium transition-colors"
                >
                  View Silks
                </Link>
              </div>

              {/* Offer Highlight Pill */}
              <div className="pt-2">
                <div className="inline-flex items-center gap-3 px-4 py-2 rounded-xl bg-background/80 border border-primary/20 shadow-sm text-xs text-foreground/85">
                  <span className="font-bold text-gold uppercase tracking-wider">Offer:</span>
                  <span>Flat 15% off silks &amp; free express shipping above ₹2,999</span>
                </div>
              </div>
            </motion.div>

            {/* Right Column: Hero Banner Showcase */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, ease: "easeOut", delay: 0.2 }}
              className="lg:col-span-7"
            >
              <div className="rounded-3xl overflow-hidden shadow-petal border border-border/60 bg-background/40 backdrop-blur-sm p-2">
                <BannerSlider
                  slides={mockSlides}
                  aspect={16 / 10}
                  radius={20}
                  autoplayDelay={5000}
                  showCaptions
                />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* LUXURY BOUTIQUE ADVANTAGES (4 Columns on Desktop) */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {[
            {
              icon: Gem,
              title: "Handcrafted Couture",
              desc: "Pure silks & premium fabrics",
            },
            {
              icon: Truck,
              title: "Express Delivery",
              desc: "Pan-India 2–5 business days",
            },
            {
              icon: RefreshCw,
              title: "Easy 7-Day Exchange",
              desc: "Hassle-free size swaps",
            },
            {
              icon: ShieldCheck,
              title: "100% Authentic",
              desc: "Certified craftsmanship",
            },
          ].map((item, idx) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
              className="glass-panel rounded-2xl p-5 flex flex-col items-center lg:items-start text-center lg:text-left gap-3 hover:border-gold/40 transition-colors"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <item.icon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-serif text-base font-semibold text-foreground">{item.title}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CATEGORY SHOWCASE (4 Columns Desktop Grid) */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] font-semibold text-primary mb-1">
              Curated Collections
            </p>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold">Discover By Category</h2>
          </div>
          <Link
            to="/shop"
            className="hidden sm:inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
          >
            All Categories <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              title: "Silks & Sarees",
              caption: "Pure Kanjivaram & Banarasi",
              image: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=800&q=80",
              category: "Clothing" as const,
            },
            {
              title: "Chiffon Silhouettes",
              caption: "Flowing dresses & dupattas",
              image: "https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=800&q=80",
              category: "Clothing" as const,
            },
            {
              title: "Rose Gold Jewellery",
              caption: "Necklaces, rings & bangles",
              image: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=800&q=80",
              category: "Accessories" as const,
            },
            {
              title: "Pearl & Clutch Bags",
              caption: "Embellished luxury accessories",
              image: "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=800&q=80",
              category: "Accessories" as const,
            },
          ].map((c, i) => (
            <motion.div
              key={c.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
            >
              <Link
                to="/shop"
                search={{ category: c.category } as any}
                className="group relative block rounded-2xl overflow-hidden aspect-[4/5] shadow-soft border border-border/40"
              >
                <motion.img
                  src={c.image}
                  alt={c.title}
                  className="w-full h-full object-cover"
                  whileHover={{ scale: 1.08 }}
                  transition={{ duration: 0.7, ease: "easeOut" }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                  <h3 className="font-serif text-2xl font-bold">{c.title}</h3>
                  <p className="mt-1 text-xs opacity-90 truncate text-sakura font-medium">
                    {c.caption}
                  </p>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* RECENTLY VIEWED STRIP */}
      <RecentlyViewedStrip />

      {/* BEST SELLERS — 3D Carousel Showcase */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-20">
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] font-semibold text-primary mb-1">
              Best Sellers
            </p>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold">In Full Bloom</h2>
          </div>
          <Link
            to="/shop"
            className="hidden sm:inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
          >
            Shop All Products <ArrowRight className="w-4 h-4" />
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
