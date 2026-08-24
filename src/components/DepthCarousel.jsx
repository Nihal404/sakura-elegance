import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { ChevronLeft, ChevronRight } from "lucide-react";
import "./DepthCarousel.css";

/**
 * DepthCarousel — 3D depth-stacked carousel (React Bits style), adapted for
 * Zari Boutique product showcases. Cards recede in Z, fan out in X and fade
 * with distance from the active index. GSAP drives the transitions.
 */
export function DepthCarousel({
  items = [],
  cardWidth = 340,
  cardHeight = 460,
  depth = 200,
  spread = 75,
  tilt = 20,
  perspective = 1300,
  falloff = 0.2,
  blur = 5,
  visibleCards = 4,
  autoplay = true,
  autoplayDelay = 3800,
  loop = true,
  controls = true,
  indicators = true,
  onItemClick,
  renderItem,
  className = "",
}) {
  const [active, setActive] = useState(0);
  const [scale, setScale] = useState(1);
  const cardRefs = useRef([]);
  const stageRef = useRef(null);
  const dragRef = useRef(null);
  const hoverRef = useRef(false);

  const count = items.length;
  const reducedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedRef.current = mq.matches;
    const onChange = () => (reducedRef.current = mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Responsive down-scale so large cards fit narrow viewports.
  useEffect(() => {
    const compute = () => {
      const available = stageRef.current?.clientWidth ?? window.innerWidth;
      const needed = cardWidth + spread * Math.min(visibleCards, 3) * 2 + 48;
      setScale(Math.min(1, Math.max(0.52, available / needed)));
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, [cardWidth, spread, visibleCards]);

  const offsetOf = useCallback(
    (index) => {
      if (!count) return 0;
      let diff = index - active;
      if (loop) {
        if (diff > count / 2) diff -= count;
        if (diff < -count / 2) diff += count;
      }
      return diff;
    },
    [active, count, loop],
  );

  // Layout / animate
  useEffect(() => {
    cardRefs.current.slice(0, count).forEach((el, i) => {
      if (!el) return;
      const offset = offsetOf(i);
      const abs = Math.abs(offset);
      const hidden = abs > visibleCards;
      const clamped = Math.max(-1.5, Math.min(1.5, offset));
      gsap.to(el, {
        x: offset * spread * scale - (cardWidth * scale) / 2,
        y: -(cardHeight * scale) / 2 + abs * 6 * scale,
        z: -abs * depth,
        rotateY: -clamped * tilt,
        scale: Math.max(0.6, 1 - abs * 0.08),
        opacity: hidden ? 0 : Math.max(0.2, 1 - abs * falloff),
        filter: `blur(${Math.min(blur, abs * (blur / Math.max(1, visibleCards - 1)))}px)`,
        duration: reducedRef.current ? 0 : 0.75,
        ease: "power3.out",
        overwrite: "auto",
      });
      el.style.zIndex = String(100 - abs);
      el.style.pointerEvents = hidden ? "none" : "auto";
    });
  }, [
    active,
    count,
    offsetOf,
    spread,
    depth,
    cardWidth,
    cardHeight,
    scale,
    visibleCards,
    tilt,
    falloff,
    blur,
  ]);

  const go = useCallback(
    (dir) => {
      if (!count) return;
      setActive((prev) => {
        const next = prev + dir;
        if (loop) return (next + count) % count;
        return Math.min(count - 1, Math.max(0, next));
      });
    },
    [count, loop],
  );

  useEffect(() => {
    if (!autoplay || count < 2 || reducedRef.current) return;
    const id = window.setInterval(() => {
      if (!hoverRef.current) go(1);
    }, autoplayDelay);
    return () => window.clearInterval(id);
  }, [autoplay, autoplayDelay, count, go]);

  const stageHeight = useMemo(() => Math.round(cardHeight * scale + 90), [cardHeight, scale]);

  if (!count) return null;

  const onPointerDown = (e) => {
    dragRef.current = e.clientX;
  };
  const onPointerUp = (e) => {
    const start = dragRef.current;
    dragRef.current = null;
    if (start == null) return;
    const dx = e.clientX - start;
    if (Math.abs(dx) > 45) go(dx < 0 ? 1 : -1);
  };

  return (
    <div
      className={`depth-carousel ${className}`}
      onMouseEnter={() => (hoverRef.current = true)}
      onMouseLeave={() => (hoverRef.current = false)}
    >
      <div
        ref={stageRef}
        className="depth-carousel__stage"
        style={{ height: stageHeight, perspective: `${perspective}px` }}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (dragRef.current = null)}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") {
            e.preventDefault();
            go(1);
          } else if (e.key === "ArrowLeft") {
            e.preventDefault();
            go(-1);
          }
        }}
      >
        {items.map((item, i) => (
          <div
            key={item.id ?? i}
            ref={(el) => {
              cardRefs.current[i] = el;
            }}
            className="depth-carousel__card"
            style={{
              width: cardWidth * scale,
              height: cardHeight * scale,
              opacity: 0,
            }}
            role="button"
            tabIndex={Math.abs(offsetOf(i)) > visibleCards ? -1 : 0}
            aria-label={item.alt ?? item.name ?? `Slide ${i + 1}`}
            onClick={() => {
              if (i !== active) setActive(i);
              else onItemClick?.(item, i);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                if (i !== active) setActive(i);
                else onItemClick?.(item, i);
              }
            }}
          >
            {renderItem ? (
              renderItem(item, i, i === active)
            ) : (
              <>
                <img
                  className="depth-carousel__img"
                  src={item.image}
                  alt={item.alt ?? item.name ?? ""}
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                />
                <div className="depth-carousel__meta">
                  {item.category && <p className="depth-carousel__category">{item.category}</p>}
                  <p className="depth-carousel__name">{item.name}</p>
                  {item.price != null && <p className="depth-carousel__price">₹{item.price}</p>}
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {(controls || indicators) && (
        <div className="depth-carousel__controls">
          {controls && (
            <button
              type="button"
              className="depth-carousel__btn"
              onClick={() => go(-1)}
              aria-label="Previous product"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
          {indicators && (
            <div className="depth-carousel__indicators" role="tablist">
              {items.map((item, i) => (
                <button
                  key={item.id ?? i}
                  type="button"
                  role="tab"
                  aria-selected={i === active}
                  aria-label={`Go to ${item.name ?? `slide ${i + 1}`}`}
                  className={`depth-carousel__dot ${i === active ? "depth-carousel__dot--active" : ""}`}
                  onClick={() => setActive(i)}
                />
              ))}
            </div>
          )}
          {controls && (
            <button
              type="button"
              className="depth-carousel__btn"
              onClick={() => go(1)}
              aria-label="Next product"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default DepthCarousel;
