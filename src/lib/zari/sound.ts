let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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
