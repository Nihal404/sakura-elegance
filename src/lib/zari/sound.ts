let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = new Ctx();
  }
  if (audioCtx.state === "suspended") {
    void audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Play a short "shaking six" / maracas-style rattle each time an item is added to cart.
 * Synthesized with the Web Audio API so no external assets are required.
 */
export function playAddToCartSound() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Create a brief noise buffer for the shaker texture.
    const duration = 0.32;
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    // Bandpass sweep to mimic a rattle decaying in tone.
    const bandpass = ctx.createBiquadFilter();
    bandpass.type = "bandpass";
    bandpass.frequency.setValueAtTime(1400, now);
    bandpass.frequency.exponentialRampToValueAtTime(350, now + duration);
    bandpass.Q.setValueAtTime(1.5, now);

    // Short amplitude envelope with tiny "beads" via multiple bursts.
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.22, now);
    for (let i = 0; i < 6; i++) {
      const t = now + i * 0.045;
      gain.gain.linearRampToValueAtTime(0.22, t);
      gain.gain.linearRampToValueAtTime(0.06, t + 0.025);
    }
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(bandpass).connect(gain).connect(ctx.destination);
    noise.start(now);
    noise.stop(now + duration + 0.05);
  } catch {
    // Audio is optional; ignore browser autoplay or API errors.
  }
}

/**
 * Play a bright, delighted chime when the user clicks "Buy Now".
 * Synthesized with the Web Audio API: a rising major arpeggio plus a soft shimmer.
 */
export function playDelightedSound() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.35, now);
    master.gain.exponentialRampToValueAtTime(0.001, now + 1.6);
    master.connect(ctx.destination);

    // Major arpeggio: C5 - E5 - G5 - C6
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      const t = now + i * 0.11;
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, t);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.18, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);

      osc.connect(gain).connect(master);
      osc.start(t);
      osc.stop(t + 0.6);
    });

    // Soft shimmer (high-frequency sparkle) on top of the chime.
    const shimmerDuration = 1.0;
    const shimmerBuffer = ctx.createBuffer(
      1,
      Math.floor(ctx.sampleRate * shimmerDuration),
      ctx.sampleRate,
    );
    const shimmerData = shimmerBuffer.getChannelData(0);
    for (let i = 0; i < shimmerData.length; i++) {
      shimmerData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / shimmerData.length, 2.5);
    }
    const shimmer = ctx.createBufferSource();
    shimmer.buffer = shimmerBuffer;

    const shimmerFilter = ctx.createBiquadFilter();
    shimmerFilter.type = "bandpass";
    shimmerFilter.frequency.setValueAtTime(3000, now);
    shimmerFilter.frequency.exponentialRampToValueAtTime(8000, now + shimmerDuration);
    shimmerFilter.Q.setValueAtTime(2.5, now);

    const shimmerGain = ctx.createGain();
    shimmerGain.gain.setValueAtTime(0.08, now);
    shimmerGain.gain.exponentialRampToValueAtTime(0.001, now + shimmerDuration);

    shimmer.connect(shimmerFilter).connect(shimmerGain).connect(master);
    shimmer.start(now);
    shimmer.stop(now + shimmerDuration);
  } catch {
    // Audio is optional; ignore browser autoplay or API errors.
  }
}

/**
 * Tiny, dry "tick" for generic UI clicks (buttons, nav pills, thumbnails).
 * Kept very short and quiet so it never becomes annoying.
 */
export function playClickSound() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const duration = 0.05;

    // Short filtered noise burst = crisp mechanical "click".
    const buffer = ctx.createBuffer(
      1,
      Math.max(1, Math.floor(ctx.sampleRate * duration)),
      ctx.sampleRate,
    );
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const p = i / data.length;
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - p, 6);
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(2100, now);
    filter.Q.setValueAtTime(1.1, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    noise.connect(filter).connect(gain).connect(ctx.destination);
    noise.start(now);
    noise.stop(now + duration + 0.01);
  } catch {
    // Audio is optional.
  }
}

/**
 * Airy "whoosh" for swapping slides / images (banner slider, galleries).
 */
export function playSwipeSound() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const duration = 0.26;

    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duration), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const p = i / data.length;
      // soft attack + decay envelope so it reads as a swoosh, not a burst of static
      data[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * p) ** 2;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(700, now);
    filter.frequency.exponentialRampToValueAtTime(3200, now + duration);
    filter.Q.setValueAtTime(0.9, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.0005, now + duration);

    noise.connect(filter).connect(gain).connect(ctx.destination);
    noise.start(now);
    noise.stop(now + duration + 0.02);
  } catch {
    // Audio is optional.
  }
}

/**
 * Soft, descending "pluck" when an item is removed from the bag or its
 * quantity is decreased — the mirror of the add-to-cart rattle.
 */
export function playRemoveFromCartSound() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(560, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.22);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.14, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0005, now + 0.26);

    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.3);
  } catch {
    // Audio is optional.
  }
}

/**
 * Warm two-note confirmation for a completed checkout / placed order.
 */
export function playCheckoutSuccessSound() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.3, now);
    master.gain.exponentialRampToValueAtTime(0.001, now + 1.1);
    master.connect(ctx.destination);

    // G5 then C6 — a clean, resolved "done" cadence.
    [783.99, 1046.5].forEach((freq, i) => {
      const t = now + i * 0.16;
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, t);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.2, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.7);

      osc.connect(gain).connect(master);
      osc.start(t);
      osc.stop(t + 0.75);
    });
  } catch {
    // Audio is optional.
  }
}
