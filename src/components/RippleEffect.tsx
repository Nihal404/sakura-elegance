import { useEffect } from "react";

/**
 * Global "ink ripple" for primary actions. Mounted once at the root; it listens for
 * pointer-down on the document and paints a short-lived expanding circle inside the
 * pressed control. Purely presentational — no React state, no re-renders.
 */
const PRIMARY_HINTS = ["bg-primary", "bg-foreground", "bg-rose-gold", "data-ripple"];

function isPrimary(el: HTMLElement) {
  if (el.hasAttribute("data-no-ripple")) return false;
  if (el.hasAttribute("data-ripple")) return true;
  const cls = el.className;
  if (typeof cls !== "string") return false;
  return PRIMARY_HINTS.some((hint) => cls.includes(hint));
}

export function RippleEffect() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      const el = target?.closest<HTMLElement>('button, [role="button"], a[data-ripple]');
      if (!el || el.hasAttribute("disabled") || !isPrimary(el)) return;

      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      const computed = window.getComputedStyle(el);
      if (computed.position === "static") el.style.position = "relative";
      el.style.overflow = "hidden";

      const size = Math.max(rect.width, rect.height) * 2.2;
      const ripple = document.createElement("span");
      ripple.className = "zari-ripple";
      ripple.style.width = `${size}px`;
      ripple.style.height = `${size}px`;
      ripple.style.left = `${event.clientX - rect.left - size / 2}px`;
      ripple.style.top = `${event.clientY - rect.top - size / 2}px`;
      ripple.addEventListener("animationend", () => ripple.remove());
      el.appendChild(ripple);
      window.setTimeout(() => ripple.remove(), 900);
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, []);

  return null;
}
