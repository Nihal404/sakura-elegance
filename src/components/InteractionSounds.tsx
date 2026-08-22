import { useEffect } from "react";
import { playClickSound } from "@/lib/zari/sound";
import { hapticTap } from "@/lib/zari/haptics";

/**
 * Global UI sound layer. Mounted once at the root.
 *
 * Rules:
 * - Only genuine button-like controls trigger the click sound (never plain
 *   icon wrappers, cards, links, scroll rails or swipe gestures).
 * - Debounced globally and per element so a single action can never double up
 *   (e.g. add-to-cart or quantity steppers that play their own sound).
 * - Sets data-pressed on the element so the CSS press animation stays in sync
 *   with the sound.
 */
const GLOBAL_DEBOUNCE_MS = 220;
const PRESS_MS = 170;

export function InteractionSounds() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    let lastPlay = 0;
    let lastEl: HTMLElement | null = null;
    let lastElAt = 0;

    const press = (el: HTMLElement) => {
      el.setAttribute("data-pressed", "true");
      window.setTimeout(() => el.removeAttribute("data-pressed"), PRESS_MS);
    };

    const onPointerDown = (event: PointerEvent) => {
      // ignore secondary buttons / synthetic duplicates
      if (event.button !== 0 || !event.isPrimary) return;

      const target = event.target as HTMLElement | null;
      const el = target?.closest<HTMLElement>('button, [role="button"], summary');
      if (!el) return;
      if (el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true") return;
      // opt-out: element (or an ancestor) plays its own richer sound
      if (el.closest("[data-no-sound]")) return;

      const now = Date.now();
      // same element pressed again immediately -> treat as one action
      if (el === lastEl && now - lastElAt < 400) return;
      if (now - lastPlay < GLOBAL_DEBOUNCE_MS) return;

      lastPlay = now;
      lastEl = el;
      lastElAt = now;
      press(el);
      playClickSound();
      hapticTap();
    };

    // keyboard activation (Enter/Space) should feel the same
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (event.key !== "Enter" && event.key !== " ") return;
      const el = (event.target as HTMLElement | null)?.closest<HTMLElement>(
        'button, [role="button"], summary',
      );
      if (!el || el.hasAttribute("disabled")) return;
      if (el.closest("[data-no-sound]")) return;
      const now = Date.now();
      if (now - lastPlay < GLOBAL_DEBOUNCE_MS) return;
      lastPlay = now;
      lastEl = el;
      lastElAt = now;
      press(el);
      playClickSound();
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, []);

  return null;
}

export default InteractionSounds;
