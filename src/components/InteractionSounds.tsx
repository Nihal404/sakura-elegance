import { useEffect } from "react";
import { playClickSound } from "@/lib/zari/sound";
import { hapticTap } from "@/lib/zari/haptics";

/**
 * Global UI sound layer. Mounted once at the root.
 * Plays a crisp click only when an actual button-like control is pressed —
 * never on generic taps, scrolls or swipes.
 * Elements can opt out with data-no-sound (their own handler usually plays a
 * richer sound, e.g. add-to-cart rattle or buy-now chime).
 */
export function InteractionSounds() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    let last = 0;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      const el = target?.closest<HTMLElement>('button, [role="button"], [role="tab"], summary');
      if (!el || el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true") return;
      if (el.closest("[data-no-sound]")) return;

      const now = Date.now();
      if (now - last < 70) return;
      last = now;
      playClickSound();
      hapticTap();
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, []);

  return null;
}

export default InteractionSounds;
