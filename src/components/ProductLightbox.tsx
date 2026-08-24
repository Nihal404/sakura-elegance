import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Minus, Plus, X } from "lucide-react";

export interface LightboxSlide {
  src: string;
  thumb?: string;
  label?: string;
}

interface Props {
  open: boolean;
  slides: LightboxSlide[];
  index: number;
  alt: string;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * ProductLightbox — full-screen luxury viewer with wheel/pinch zoom, drag pan,
 * thumbnail switching and keyboard controls. Zoom anchors on the cursor point.
 */
export function ProductLightbox({ open, slides, index, alt, onIndexChange, onClose }: Props) {
  const count = slides.length;
  const safeIndex = clamp(index, 0, Math.max(0, count - 1));
  const stageRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const stateRef = useRef({ zoom, offset });
  stateRef.current = { zoom, offset };

  const reset = useCallback(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    reset();
  }, [safeIndex, open, reset]);

  const go = useCallback(
    (dir: number) => {
      if (count < 2) return;
      onIndexChange((safeIndex + dir + count) % count);
    },
    [count, safeIndex, onIndexChange],
  );

  const zoomBy = useCallback((factor: number) => {
    const { zoom: z, offset: o } = stateRef.current;
    const next = clamp(z * factor, MIN_ZOOM, MAX_ZOOM);
    const k = next / z;
    setZoom(next);
    setOffset(next === 1 ? { x: 0, y: 0 } : { x: o.x * k, y: o.y * k });
  }, []);

  // Body scroll lock + keyboard controls
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "+" || e.key === "=") zoomBy(1.3);
      else if (e.key === "-") zoomBy(1 / 1.3);
      else if (e.key === "0") reset();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, go, zoomBy, reset]);

  // Non-passive wheel zoom anchored at the cursor.
  useEffect(() => {
    const el = stageRef.current;
    if (!el || !open) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      const { zoom: z, offset: o } = stateRef.current;
      const next = clamp(z * Math.exp(-dy * 0.0018), MIN_ZOOM, MAX_ZOOM);
      if (next === z) return;
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left - rect.width / 2;
      const py = e.clientY - rect.top - rect.height / 2;
      const k = next / z;
      setZoom(next);
      setOffset(next === 1 ? { x: 0, y: 0 } : { x: px - (px - o.x) * k, y: py - (py - o.y) * k });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [open]);

  if (!count) return null;
  const slide = slides[safeIndex];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex flex-col bg-foreground/90 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28 }}
          role="dialog"
          aria-modal="true"
          aria-label={`${alt} photo viewer`}
        >
          {/* Top bar */}
          <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4 text-background">
            <span className="text-[10px] sm:text-xs uppercase tracking-[0.25em] truncate">
              {slide?.label ?? alt} · {safeIndex + 1}/{count}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => zoomBy(1 / 1.35)}
                aria-label="Zoom out"
                className="grid place-items-center w-9 h-9 rounded-full border border-background/30 bg-background/10 hover:bg-background/20 transition-colors"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="text-xs w-10 text-center tabular-nums">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() => zoomBy(1.35)}
                aria-label="Zoom in"
                className="grid place-items-center w-9 h-9 rounded-full border border-background/30 bg-background/10 hover:bg-background/20 transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close viewer"
                className="grid place-items-center w-9 h-9 rounded-full border border-background/30 bg-background/10 hover:bg-background/20 transition-colors ml-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Stage */}
          <div
            ref={stageRef}
            className="relative flex-1 min-h-0 overflow-hidden touch-none"
            onDoubleClick={() => (zoom > 1 ? reset() : zoomBy(2))}
            onPointerDown={(e) => {
              if (stateRef.current.zoom <= 1) return;
              (e.target as Element).setPointerCapture?.(e.pointerId);
              drag.current = {
                x: e.clientX,
                y: e.clientY,
                ox: stateRef.current.offset.x,
                oy: stateRef.current.offset.y,
              };
            }}
            onPointerMove={(e) => {
              const d = drag.current;
              if (!d) return;
              setOffset({ x: d.ox + (e.clientX - d.x), y: d.oy + (e.clientY - d.y) });
            }}
            onPointerUp={() => (drag.current = null)}
            onPointerCancel={() => (drag.current = null)}
          >
            <motion.img
              key={slide?.src}
              src={slide?.src}
              alt={alt}
              draggable={false}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-0 w-full h-full object-contain p-4 sm:p-8"
              style={{
                transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${zoom})`,
                cursor: zoom > 1 ? "grab" : "zoom-in",
              }}
              onClick={() => zoom === 1 && zoomBy(2)}
            />

            {count > 1 && (
              <div className="absolute inset-y-0 left-0 right-0 flex items-center justify-between px-3 sm:px-5 pointer-events-none">
                <button
                  type="button"
                  onClick={() => go(-1)}
                  aria-label="Previous photo"
                  className="pointer-events-auto grid place-items-center w-11 h-11 rounded-full border border-background/30 bg-foreground/40 text-background backdrop-blur hover:bg-foreground/60 transition-all hover:scale-105"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => go(1)}
                  aria-label="Next photo"
                  className="pointer-events-auto grid place-items-center w-11 h-11 rounded-full border border-background/30 bg-foreground/40 text-background backdrop-blur hover:bg-foreground/60 transition-all hover:scale-105"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>

          {/* Thumbnails */}
          {count > 1 && (
            <div className="px-4 sm:px-6 py-4">
              <div className="flex gap-3 overflow-x-auto justify-start sm:justify-center">
                {slides.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => onIndexChange(i)}
                    aria-label={`Photo ${i + 1}`}
                    aria-current={i === safeIndex}
                    className={`shrink-0 w-16 h-16 rounded-2xl overflow-hidden border-2 bg-background/10 transition-all ${
                      i === safeIndex
                        ? "border-primary scale-105"
                        : "border-background/25 opacity-60 hover:opacity-100"
                    }`}
                  >
                    <img
                      src={s.thumb ?? s.src}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-contain"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default ProductLightbox;
