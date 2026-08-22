/**
 * Subtle mobile haptics. Uses the Vibration API where available (Android/Chrome);
 * silently does nothing on desktop and iOS Safari. Respects reduced-motion.
 */
function canVibrate() {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  if (typeof navigator.vibrate !== "function") return false;
  try {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  } catch {
    /* matchMedia unavailable — continue */
  }
  return true;
}

function buzz(pattern: number | number[]) {
  if (!canVibrate()) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* haptics are optional */
  }
}

/** Feather-light tap for button presses. */
export const hapticTap = () => buzz(8);

/** Slightly longer blip for slide/photo changes. */
export const hapticSwipe = () => buzz(14);

/** Two quick pulses for a completed action (checkout, order placed). */
export const hapticSuccess = () => buzz([16, 60, 26]);
