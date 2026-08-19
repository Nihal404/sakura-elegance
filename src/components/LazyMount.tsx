import { memo, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Windowing primitive: keeps a fixed-height slot in the layout but only mounts its
 * children while the slot is near the viewport. Far-offscreen cards unmount, which
 * releases their image references from the rolling image budget — so a 500-product
 * infinite scroll never keeps hundreds of cards (or images) alive at once.
 */
export const LazyMount = memo(function LazyMount({
  children,
  className = "",
  placeholder,
  /** How far outside the viewport a slot stays mounted. */
  margin = "800px 0px",
}: {
  children: ReactNode;
  className?: string;
  placeholder?: ReactNode;
  margin?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setActive(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => setActive(Boolean(entry?.isIntersecting)),
      { rootMargin: margin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [margin]);

  return (
    <div ref={ref} className={className}>
      {active ? children : (placeholder ?? <div className="aspect-[3/4] rounded-3xl bg-blush/50" />)}
    </div>
  );
});
