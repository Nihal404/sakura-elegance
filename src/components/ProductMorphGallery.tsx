import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ChevronLeft, ChevronRight, Images } from "lucide-react";

export interface GalleryView {
  src: string;
  label: string;
  frame: string;
  transform: string;
}

interface Props {
  views: GalleryView[];
  alt: string;
  activeIndex: number;
  onChange: (index: number) => void;
}

/**
 * ProductMorphGallery — premium 3D depth/morph transition between product photos.
 * Outgoing image recedes (scale down, blur, fade); incoming image comes forward
 * with directional drift based on navigation direction. GSAP driven, tween-safe
 * on rapid clicks, and reduced-motion aware.
 */
export function ProductMorphGallery({ views, alt, activeIndex, onChange }: Props) {
  const count = views.length;
  const index = Math.min(activeIndex, Math.max(0, count - 1));

  const stageRef = useRef<HTMLDivElement>(null);
  const layerA = useRef<HTMLDivElement>(null);
  const layerB = useRef<HTMLDivElement>(null);
  const frontIsA = useRef(true);
  const shown = useRef(index);
  const tweenRef = useRef<gsap.core.Timeline | null>(null);
  const dragX = useRef<number | null>(null);
  const reduced = useRef(false);

  const [frontView, setFrontView] = useState(views[index]);
  const [backView, setBackView] = useState(views[index]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reduced.current = mq.matches;
    const onChangeMq = () => (reduced.current = mq.matches);
    mq.addEventListener("change", onChangeMq);
    return () => mq.removeEventListener("change", onChangeMq);
  }, []);

  // Morph on index change
  useEffect(() => {
    if (!count) return;
    if (index === shown.current) {
      // keep front layer in sync if the view object changed (e.g. data refresh)
      setFrontView(views[index]);
      return;
    }

    const dir = index > shown.current ? 1 : -1;
    shown.current = index;

    // Finish any in-flight tween instantly so state never desyncs.
    tweenRef.current?.progress(1).kill();
    tweenRef.current = null;

    const incoming = frontIsA.current ? layerB.current : layerA.current;
    const outgoing = frontIsA.current ? layerA.current : layerB.current;
    if (!incoming || !outgoing) return;

    // Incoming layer gets the new photo, outgoing keeps the old one.
    if (frontIsA.current) setBackView(views[index]);
    else setFrontView(views[index]);
    frontIsA.current = !frontIsA.current;

    if (reduced.current) {
      gsap.set(incoming, { opacity: 1, zIndex: 2, scale: 1, x: 0, z: 0, filter: "blur(0px)" });
      gsap.set(outgoing, { opacity: 0, zIndex: 1 });
      return;
    }

    gsap.set(incoming, {
      opacity: 0,
      zIndex: 2,
      scale: 1.14,
      x: dir * 42,
      z: 140,
      filter: "blur(10px)",
    });
    gsap.set(outgoing, { zIndex: 1 });

    const tl = gsap.timeline({
      defaults: { ease: "power3.out" },
      onComplete: () => {
        gsap.set(outgoing, { opacity: 0, filter: "blur(0px)", scale: 1, x: 0, z: 0 });
        tweenRef.current = null;
      },
    });
    tl.to(
      outgoing,
      { opacity: 0, scale: 0.9, x: -dir * 34, z: -180, filter: "blur(8px)", duration: 0.62 },
      0,
    ).to(
      incoming,
      { opacity: 1, scale: 1, x: 0, z: 0, filter: "blur(0px)", duration: 0.7 },
      0.04,
    );
    tweenRef.current = tl;
  }, [index, count, views]);

  useEffect(() => () => void tweenRef.current?.kill(), []);

  const go = useCallback(
    (dir: number) => {
      if (count < 2) return;
      onChange((index + dir + count) % count);
    },
    [count, index, onChange],
  );

  if (!count) return null;
  const current = views[index];

  return (
    <div className="relative">
      <div
        ref={stageRef}
        className={`relative aspect-[4/5] w-full max-w-full rounded-3xl overflow-hidden shadow-petal ${current.frame} touch-pan-y select-none`}
        style={{ perspective: "1200px" }}
        tabIndex={0}
        role="group"
        aria-label={`${alt} photo ${index + 1} of ${count}`}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") {
            e.preventDefault();
            go(1);
          } else if (e.key === "ArrowLeft") {
            e.preventDefault();
            go(-1);
          }
        }}
        onPointerDown={(e) => (dragX.current = e.clientX)}
        onPointerUp={(e) => {
          const start = dragX.current;
          dragX.current = null;
          if (start == null) return;
          const dx = e.clientX - start;
          if (Math.abs(dx) > 45) go(dx < 0 ? 1 : -1);
        }}
        onPointerCancel={() => (dragX.current = null)}
      >
        <div
          ref={layerA}
          className="absolute inset-0"
          style={{ willChange: "transform, opacity, filter", zIndex: 2 }}
        >
          <img
            src={frontView?.src}
            alt={alt}
            draggable={false}
            className={`w-full h-full object-contain ${frontView?.transform ?? ""}`}
          />
        </div>
        <div
          ref={layerB}
          className="absolute inset-0 opacity-0"
          style={{ willChange: "transform, opacity, filter", zIndex: 1 }}
        >
          <img
            src={backView?.src}
            alt=""
            aria-hidden="true"
            draggable={false}
            className={`w-full h-full object-contain ${backView?.transform ?? ""}`}
          />
        </div>

        <span className="absolute top-5 left-5 z-10 text-[10px] uppercase tracking-[0.2em] px-3 py-1 rounded-full bg-background/85 backdrop-blur text-foreground/80">
          {current.label}
        </span>

        {count > 1 && (
          <>
            <div className="absolute inset-y-0 left-0 right-0 z-10 flex items-center justify-between px-3 pointer-events-none">
              <button
                type="button"
                onClick={() => go(-1)}
                aria-label="Previous photo"
                className="pointer-events-auto grid place-items-center w-10 h-10 rounded-full border border-border/70 bg-background/80 backdrop-blur text-foreground/80 shadow-soft transition-all hover:bg-background hover:text-primary hover:scale-105"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => go(1)}
                aria-label="Next photo"
                className="pointer-events-auto grid place-items-center w-10 h-10 rounded-full border border-border/70 bg-background/80 backdrop-blur text-foreground/80 shadow-soft transition-all hover:bg-background hover:text-primary hover:scale-105"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => go(1)}
              className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border/70 bg-background/85 backdrop-blur text-xs tracking-wide text-foreground/80 shadow-soft transition-all hover:bg-background hover:text-primary"
              aria-label="Change photo"
            >
              <Images className="w-3.5 h-3.5 text-primary" />
              Change photo
              <span className="text-foreground/50">
                {index + 1}/{count}
              </span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default ProductMorphGallery;
