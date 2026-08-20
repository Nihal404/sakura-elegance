import { memo, useEffect, useRef, useState } from "react";
import { imageBudget } from "@/lib/zari/image-cache";
import { acquireImage, releaseImage } from "@/lib/zari/image-store";
import {
  CARD_WIDTHS,
  invalidateVariants,
  isStorageSource,
  signedVariantUrl,
  cachedVariantUrl,
  type VariantRequest,
} from "@/lib/zari/image-url";

interface ProductImageProps {
  /** A sized (transformed) URL — build it with cardImageUrl/galleryImageUrl/thumbImageUrl. */
  src: string;
  /**
   * The raw stored value (`product.image` / a mockup entry). Required for private-bucket
   * objects: the right-sized variant has to be signed from the object path.
   */
  rawSrc?: string;
  /** Which resized variant this slot needs (card ~400px, gallery ~1000px, thumb ~160px). */
  variant?: VariantRequest;
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
 * Pipeline, in order:
 *  1. resolve a right-sized source — private-bucket objects get a signed *render* URL so a
 *     card downloads ~60 KB instead of the 2.5–4 MB original (the real reason mobile stalled
 *     on the pink placeholder);
 *  2. serve it through the persistent app cache (Cache Storage, ~50 MB LRU) as a blob URL,
 *     so navigating away and back repaints instantly;
 *  3. on any cache/network trouble, fall back to the plain signed URL on the <img>;
 *  4. on an <img> error, re-sign once (stale/invalid token) before showing an error state.
 *
 * It also keeps the existing decoded-memory budget accounting, which is tracked separately
 * from cached bytes.
 */
export const ProductImage = memo(function ProductImage({
  src,
  rawSrc,
  variant,
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
  const origin = rawSrc || src;
  const spec: VariantRequest = variant ?? {
    width: width ?? 400,
    quality: 70,
    ladder: CARD_WIDTHS,
  };

  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  /** The network URL for this slot (signed variant, or a plain http URL). */
  const [netSrc, setNetSrc] = useState(() =>
    isStorageSource(origin) ? (cachedVariantUrl(origin, spec) ?? "") : src,
  );
  /** Blob URL from the persistent cache, when available. */
  const [blobSrc, setBlobSrc] = useState<string | null>(null);
  const resignedRef = useRef(false);
  const ref = useRef<HTMLImageElement | null>(null);

  const displaySrc = blobSrc ?? netSrc;
  const isOriginalSrc = displaySrc === src;

  // 1. Resolve the right-sized, valid network URL.
  useEffect(() => {
    let alive = true;
    setFailed(false);
    setLoaded(false);
    setBlobSrc(null);
    resignedRef.current = false;

    if (!isStorageSource(origin)) {
      setNetSrc(src);
      return;
    }
    const cached = cachedVariantUrl(origin, spec);
    if (cached) setNetSrc(cached);
    signedVariantUrl(origin, spec)
      .then((next) => {
        if (alive && next) setNetSrc(next);
      })
      .catch((error) => {
        console.warn("[zari:image] could not resolve source", { origin, error });
        if (alive) setNetSrc(src);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin, src, spec.width, spec.quality]);

  // 2. Serve through the persistent cache; failures fall back to the network URL.
  useEffect(() => {
    if (!netSrc) return;
    let alive = true;
    let held: string | null = null;
    acquireImage(netSrc)
      .then((objectUrl) => {
        if (!alive) {
          releaseImage(netSrc);
          return;
        }
        held = netSrc;
        setBlobSrc(objectUrl);
      })
      .catch((error) => {
        // Cache Storage unavailable, CORS or network error: use the URL directly.
        console.warn("[zari:image] cache path unavailable, using network URL", {
          url: netSrc,
          error: (error as Error)?.message ?? error,
        });
      });
    return () => {
      alive = false;
      if (held) releaseImage(held);
    };
  }, [netSrc]);

  // Decoded-memory budget: one retain per mounted element (separate from cached bytes).
  useEffect(() => {
    if (!displaySrc) return;
    imageBudget.retain(displaySrc);
    return () => imageBudget.release(displaySrc);
  }, [displaySrc]);

  // Visibility feeds eviction order — offscreen references go first.
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined" || !displaySrc) return;
    let visible = false;
    const io = new IntersectionObserver(
      ([entry]) => {
        const now = Boolean(entry?.isIntersecting);
        if (now === visible) return;
        visible = now;
        imageBudget.setVisible(displaySrc, now);
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      if (visible) imageBudget.setVisible(displaySrc, false);
    };
  }, [displaySrc]);

  return (
    <>
      {!loaded && !failed && (
        <div className="absolute inset-0 bg-sakura-gradient animate-pulse" aria-hidden="true" />
      )}
      {failed ? (
        <div className="absolute inset-0 flex items-center justify-center bg-blush text-[10px] uppercase tracking-[0.18em] text-foreground/50">
          Image unavailable
        </div>
      ) : displaySrc ? (
        <img
          ref={ref}
          src={displaySrc}
          // A signed/blob source must not be overridden by the original srcset.
          srcSet={isOriginalSrc ? srcSet : undefined}
          sizes={isOriginalSrc ? sizes : undefined}
          alt={alt}
          width={width}
          height={height}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={fetchPriority}
          onLoad={(e) => {
            const img = e.currentTarget;
            imageBudget.measured(displaySrc, img.naturalWidth, img.naturalHeight);
            setLoaded(true);
            onLoaded?.();
          }}
          onError={() => {
            console.warn("[zari:image] <img> failed to load", { url: displaySrc, origin });
            if (blobSrc) {
              // Blob went stale (revoked): retry over the network.
              setBlobSrc(null);
              return;
            }
            if (!resignedRef.current && isStorageSource(origin)) {
              resignedRef.current = true;
              invalidateVariants(origin);
              signedVariantUrl(origin, spec, { force: true })
                .then((next) => {
                  if (next && next !== netSrc) setNetSrc(next);
                  else setFailed(true);
                })
                .catch(() => setFailed(true));
              return;
            }
            setFailed(true);
          }}
          className={`${className} transition-opacity duration-500 ease-out ${
            loaded ? "opacity-100" : "opacity-0"
          }`}
        />
      ) : null}
    </>
  );
});
