import { useEffect } from "react";
import { playClickSound, playSwipeSound } from "@/lib/zari/sound";
import { hapticSwipe, hapticTap } from "@/lib/zari/haptics";

/**
 * Global UI sound layer. Mounted once at the root.
 * - short tick on any button / link / control press
 * - airy whoosh on horizontal swipe gestures
 * Elements can opt out with data-no-sound (their own handler usually plays a
 * richer sound, e.g. add-to-cart rattle or buy-now chime).
 */
export function InteractionSounds() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    let last = 0;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      const el = target?.closest<HTMLElement>(
        'button, a, [role="button"], [role="tab"], summary, input[type="checkbox"], input[type="radio"], select',
      );
      if (!el || el.hasAttribute("disabled")) return;
      if (el.closest("[data-no-sound]")) return;

      const now = Date.now();
      if (now - last < 60) return;
      last = now;
      playClickSound();
      hapticTap();
    };

    let startX: number | null = null;
    let startY: number | null = null;
    const onTouchStart = (e: TouchEvent) => {
      startX = e.touches[0]?.clientX ?? null;
      startY = e.touches[0]?.clientY ?? null;
    };
    const onTouchEnd = (e: TouchEvent) => {
      const sx = startX;
      const sy = startY;
      startX = null;
      startY = null;
      const ex = e.changedTouches[0]?.clientX;
      const ey = e.changedTouches[0]?.clientY;
      if (sx == null || sy == null || ex == null || ey == null) return;
      const dx = Math.abs(ex - sx);
      const dy = Math.abs(ey - sy);
      if (dx > 48 && dx > dy * 1.5) {
        playSwipeSound();
        hapticSwipe();
      }
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  return null;
}

export default InteractionSounds;
