import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface BannerSlide {
  image: string;
  caption?: string;
}

/**
 * Home banner slider.
 *
 * Deliberately plain <img> based: the previous WebGL slider silently painted an empty
 * canvas on devices where the texture upload failed, which showed up as a blank/broken
 * banner even though the image itself was perfectly loadable. Images are letterboxed
 * (`object-contain`) over a blurred copy of themselves so campaign art is never cropped
 * or stretched, and slides crossfade with a soft zoom for a premium feel.
 */
export function BannerSlider({
  slides,
  aspect = 4 / 3,
  radius = 28,
  autoplayDelay = 5000,
  showCaptions = true,
  className = "",
}: {
  slides: BannerSlide[];
  aspect?: number;
  radius?: number;
  autoplayDelay?: number;
  showCaptions?: boolean;
  className?: string;
}) {
  const usable = slides.filter((s) => s && s.image);
  const [index, setIndex] = useState(0);
  const count = usable.length;
  const hover = useRef(false);
  const touchStart = useRef<number | null>(null);

  useEffect(() => {
    if (index >= count) setIndex(0);
  }, [count, index]);

  const go = useCallback(
    (next: number) => {
      if (count < 1) return;
      setIndex(((next % count) + count) % count);
    },
    [count],
  );

  useEffect(() => {
    if (count < 2 || !autoplayDelay) return;
    const id = setInterval(() => {
      if (!hover.current) setIndex((i) => (i + 1) % count);
    }, autoplayDelay);
    return () => clearInterval(id);
  }, [count, autoplayDelay]);

  if (!count) {
    return (
      <div
        className={`w-full bg-gradient-to-br from-primary/10 to-secondary/20 animate-pulse ${className}`}
        style={{ aspectRatio: String(aspect), borderRadius: radius }}
      />
    );
  }

  const active = usable[Math.min(index, count - 1)]!;

  return (
    <div
      className={`relative w-full overflow-hidden bg-background ${className}`}
      style={{ aspectRatio: String(aspect), borderRadius: radius }}
      role="region"
      aria-roledescription="carousel"
      aria-label="Featured banners"
      onMouseEnter={() => (hover.current = true)}
      onMouseLeave={() => (hover.current = false)}
      onTouchStart={(e) => (touchStart.current = e.touches[0]?.clientX ?? null)}
      onTouchEnd={(e) => {
        const start = touchStart.current;
        touchStart.current = null;
        const end = e.changedTouches[0]?.clientX;
        if (start == null || end == null) return;
        if (Math.abs(end - start) > 44) go(index + (end < start ? 1 : -1));
      }}
    >
      <AnimatePresence initial={false}>
        <motion.div
          key={`${active.image}-${index}`}
          className="absolute inset-0"
          initial={{ opacity: 0, scale: 1.04 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          {/* blurred backdrop fills the letterbox margins */}
          <img
            src={active.image}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-60"
          />
          <img
            src={active.image}
            alt={active.caption || "Featured banner"}
            loading={index === 0 ? "eager" : "lazy"}
            decoding="async"
            onLoad={() => setLoaded((m) => ({ ...m, [active.image]: true }))}
            onError={() => setLoaded((m) => ({ ...m, [active.image]: true }))}
            className={`relative w-full h-full object-contain transition-opacity duration-500 ${
              ready ? "opacity-100" : "opacity-0"
            }`}
          />
        </motion.div>
      </AnimatePresence>

      {/* LOADING SKELETON — blurred shimmer so the banner never flashes blank */}
      {!ready && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none bg-gradient-to-br from-primary/10 via-secondary/20 to-primary/10">
          <div className="absolute inset-y-0 -left-1/3 w-1/3 blur-xl bg-white/40 animate-zari-shimmer" />
        </div>
      )}


      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-foreground/45 to-transparent pointer-events-none" />

      {showCaptions && active.caption && (
        <div className="absolute bottom-8 right-4 left-4 text-right text-sm sm:text-base text-white/95 font-medium drop-shadow">
          {active.caption}
        </div>
      )}

      {count > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous banner"
            onClick={() => go(index - 1)}
            className="absolute left-2 top-1/2 -translate-y-1/2 h-9 w-9 grid place-items-center rounded-full bg-background/70 backdrop-blur text-foreground shadow-sm"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            aria-label="Next banner"
            onClick={() => go(index + 1)}
            className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 grid place-items-center rounded-full bg-background/70 backdrop-blur text-foreground shadow-sm"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
            {usable.map((s, i) => (
              <button
                key={`${s.image}-${i}`}
                type="button"
                aria-label={`Go to banner ${i + 1}`}
                aria-current={i === index}
                onClick={() => go(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? "w-6 bg-white" : "w-1.5 bg-white/60"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default BannerSlider;
