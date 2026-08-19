import { memo, useEffect, useRef, useState } from "react";
import { imageBudget } from "@/lib/zari/image-cache";
import { disableImageTransforms, originalImageUrl } from "@/lib/zari/image-url";

interface ProductImageProps {
  /** A sized (transformed) URL — build it with cardImageUrl/galleryImageUrl/thumbImageUrl. */
  src: string;
  srcSet?: string;
  sizes?: string;
  alt: string;
  className?: string;
  /** Intrinsic hints so the grid never shifts while images stream in. */
  width?: number;
  height?: number;
  eager?: boolean;
  fetchPriority?: "high" | "low" | "auto";
  onLoaded?: () => void;
}

/**
 * The single <img> used for every product image.
 *
 * - lazy by default, so only near-viewport images are fetched
 * - registers with the rolling image budget and releases on unmount
 * - reports visibility so the budget evicts offscreen references first
 * - falls back to the original object URL if a transformed variant ever fails
 */
export const ProductImage = memo(function ProductImage({
  src,
  srcSet,
  sizes,
  alt,
  className = "",
  width,
  height,
  eager = false,
  fetchPriority,
  onLoaded,
}: ProductImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [resolved, setResolved] = useState(src);
  const ref = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    setResolved(src);
    setFailed(false);
    setLoaded(false);
  }, [src]);

  // Budget accounting: one retain per mounted element.
  useEffect(() => {
    if (!resolved) return;
    imageBudget.retain(resolved);
    return () => imageBudget.release(resolved);
  }, [resolved]);

  // Visibility feeds eviction order — offscreen references go first.
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined" || !resolved) return;
    let visible = false;
    const io = new IntersectionObserver(
      ([entry]) => {
        const now = Boolean(entry?.isIntersecting);
        if (now === visible) return;
        visible = now;
        imageBudget.setVisible(resolved, now);
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      if (visible) imageBudget.setVisible(resolved, false);
    };
  }, [resolved]);

  return (
    <>
      {!loaded && !failed && (
        <div className="absolute inset-0 bg-sakura-gradient animate-pulse" aria-hidden="true" />
      )}
      {failed ? (
        <div className="absolute inset-0 flex items-center justify-center bg-blush text-[10px] uppercase tracking-[0.18em] text-foreground/50">
          Image unavailable
        </div>
      ) : (
        <img
          ref={ref}
          src={resolved}
          srcSet={srcSet}
          sizes={sizes}
          alt={alt}
          width={width}
          height={height}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          {...(fetchPriority ? { fetchpriority: fetchPriority } : {})}
          onLoad={(e) => {
            const img = e.currentTarget;
            imageBudget.measured(resolved, img.naturalWidth, img.naturalHeight);
            setLoaded(true);
            onLoaded?.();
          }}
          onError={() => {
            const original = originalImageUrl(resolved);
            if (original && original !== resolved) {
              // Transformations unavailable (or variant missing): serve originals from here on.
              disableImageTransforms();
              setResolved(original);
              return;
            }
            setFailed(true);
          }}
          className={`${className} transition-opacity duration-500 ease-out ${
            loaded ? "opacity-100" : "opacity-0"
          }`}
        />
      )}
    </>
  );
});
