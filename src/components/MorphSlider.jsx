import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import "./MorphSlider.css";

const VERT = /* glsl */ `
attribute vec2 uv;
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;

uniform sampler2D uFrom;
uniform sampler2D uTo;
uniform vec2 uFromSize;
uniform vec2 uToSize;
uniform vec2 uResolution;
uniform float uProgress;
uniform float uTime;
uniform float uIntensity;
uniform float uAberration;
uniform float uDrift;
uniform float uMelt;
uniform float uFit; // 0 = cover, 1 = contain (letterboxed, never stretched)

vec2 containUv(vec2 uv, vec2 texSize, float zoom) {
  float canvasAspect = uResolution.x / max(uResolution.y, 1.0);
  float texAspect = texSize.x / max(texSize.y, 1.0);
  vec2 scale = canvasAspect > texAspect
    ? vec2(texAspect / canvasAspect, 1.0)
    : vec2(1.0, canvasAspect / texAspect);
  uv = (uv - 0.5) / (scale * zoom) + 0.5;
  return uv;
}

vec2 coverUv(vec2 uv, vec2 texSize, float zoom) {
  float canvasAspect = uResolution.x / max(uResolution.y, 1.0);
  float texAspect = texSize.x / max(texSize.y, 1.0);
  vec2 scale = canvasAspect > texAspect
    ? vec2(1.0, texAspect / canvasAspect)
    : vec2(canvasAspect / texAspect, 1.0);
  uv = (uv - 0.5) / (scale * zoom) + 0.5;
  return uv;
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

vec4 sampleTex(sampler2D tex, vec2 texSize, vec2 uv, float zoom, float ab) {
  vec2 base = coverUv(uv, texSize, zoom);
  if (uFit > 0.5) {
    // Contain: the whole banner is visible at its true aspect ratio; the
    // leftover margin is filled with a dimmed, blown-up version of itself.
    vec2 inner = containUv(uv, texSize, zoom);
    bool outside = inner.x < 0.0 || inner.x > 1.0 || inner.y < 0.0 || inner.y > 1.0;
    if (!outside) {
      base = inner;
    } else {
      vec4 bg = texture2D(tex, clamp(base, 0.0, 1.0));
      return vec4(bg.rgb * 0.45, 1.0);
    }
  }
  if (ab < 0.0005) return texture2D(tex, base);
  vec2 dir = (uv - 0.5) * ab * 0.06;
  float r = texture2D(tex, base + dir).r;
  float g = texture2D(tex, base).g;
  float b = texture2D(tex, base - dir).b;
  float a = texture2D(tex, base).a;
  return vec4(r, g, b, a);
}

void main() {
  float p = clamp(uProgress, 0.0, 1.0);
  float ease = p * p * (3.0 - 2.0 * p);

  float n = noise(vUv * 3.0 + vec2(uTime * 0.05, uTime * 0.03));
  float bulge = sin(ease * 3.14159265) ;
  float melt = uMelt * uIntensity * bulge;

  vec2 warpFrom = vUv + vec2(0.0, (n - 0.5) * melt * 0.35) + vec2((n - 0.5) * melt * 0.12, 0.0);
  vec2 warpTo = vUv - vec2(0.0, (n - 0.5) * melt * 0.35) - vec2((n - 0.5) * melt * 0.12, 0.0);

  float driftZoom = 1.0 + uDrift * 0.06 * (0.5 + 0.5 * sin(uTime * 0.25));
  float ab = uAberration * bulge;

  vec4 from = sampleTex(uFrom, uFromSize, warpFrom, driftZoom, ab);
  vec4 to = sampleTex(uTo, uToSize, warpTo, driftZoom, ab);

  float edge = smoothstep(0.0, 1.0, ease + (n - 0.5) * melt * 0.9);
  vec3 color = mix(from.rgb, to.rgb, uMelt > 0.5 ? edge : ease);

  gl_FragColor = vec4(color, 1.0);
}
`;

function prefersReducedMotion() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function MorphSlider({
  items = [],
  transition = "melt",
  intensity = 0.55,
  aberration = 0.35,
  drift = 0.4,
  autoplay = true,
  autoplayDelay = 4,
  loop = true,
  showCaptions = true,
  showControls = true,
  showIndicators = true,
  radius = 16,
  aspect = 4 / 5,
  fit = "cover",
  className = "",
  onSlideChange,
}) {
  const slides = useMemo(() => items.filter((it) => it && it.image), [items]);
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const glRef = useRef(null);
  const [index, setIndex] = useState(0);
  const [ready, setReady] = useState(false);
  const indexRef = useRef(0);
  const animatingRef = useRef(false);
  const hoverRef = useRef(false);
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current = prefersReducedMotion();
  }, []);

  /* ---------- WebGL setup ---------- */
  useEffect(() => {
    if (!slides.length || typeof window === "undefined") return;
    let disposed = false;
    let ctx = null;

    (async () => {
      let ogl, gsap;
      try {
        [ogl, gsap] = await Promise.all([
          import("ogl"),
          import("gsap").then((m) => m.gsap ?? m.default),
        ]);
      } catch {
        return;
      }
      if (disposed || !canvasRef.current) return;

      const { Renderer, Program, Mesh, Triangle, Texture } = ogl;
      let renderer;
      try {
        renderer = new Renderer({
          canvas: canvasRef.current,
          dpr: Math.min(window.devicePixelRatio || 1, 2),
          alpha: false,
          antialias: true,
        });
      } catch {
        return;
      }
      const gl = renderer.gl;
      gl.clearColor(1, 1, 1, 1);

      const blank = new Texture(gl);
      const program = new Program(gl, {
        vertex: VERT,
        fragment: FRAG,
        uniforms: {
          uFrom: { value: blank },
          uTo: { value: blank },
          uFromSize: { value: [1, 1] },
          uToSize: { value: [1, 1] },
          uResolution: { value: [1, 1] },
          uProgress: { value: 1 },
          uTime: { value: 0 },
          uIntensity: { value: intensity },
          uAberration: { value: aberration },
          uDrift: { value: drift },
          uMelt: { value: transition === "melt" ? 1 : 0 },
          uFit: { value: fit === "contain" ? 1 : 0 },
        },
      });
      const mesh = new Mesh(gl, { geometry: new Triangle(gl), program });

      const textures = slides.map(() => null);
      // Product photos are 3000–4000px originals. Uploading one of those straight into a
      // texture blows past the texture budget on phones (WebGL silently keeps the blank
      // texture, so the banner paints white). Downscale onto a canvas first.
      const MAX_TEX = 1600;
      const toTextureSource = (img) => {
        const w = img.naturalWidth || 1;
        const h = img.naturalHeight || 1;
        const scale = Math.min(1, MAX_TEX / Math.max(w, h));
        if (scale >= 1) return { source: img, size: [w, h] };
        const cw = Math.max(1, Math.round(w * scale));
        const ch = Math.max(1, Math.round(h * scale));
        try {
          const c = document.createElement("canvas");
          c.width = cw;
          c.height = ch;
          const c2d = c.getContext("2d");
          if (!c2d) return { source: img, size: [w, h] };
          c2d.drawImage(img, 0, 0, cw, ch);
          return { source: c, size: [cw, ch] };
        } catch {
          return { source: img, size: [w, h] };
        }
      };
      const loadTexture = (i) =>
        new Promise((resolve) => {
          if (textures[i]) return resolve(textures[i]);
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.decoding = "async";
          img.onload = () => {
            try {
              const { source, size } = toTextureSource(img);
              const tex = new Texture(gl, { image: source, generateMipmaps: false });
              tex.__size = size;
              textures[i] = tex;
              resolve(tex);
            } catch {
              resolve(null);
            }
          };
          img.onerror = () => resolve(null);
          img.src = slides[i].image;
        });


      const resize = () => {
        const el = containerRef.current;
        if (!el) return;
        const w = el.clientWidth || 1;
        const h = el.clientHeight || 1;
        renderer.setSize(w, h);
        program.uniforms.uResolution.value = [w, h];
      };
      resize();
      const ro = new ResizeObserver(resize);
      if (containerRef.current) ro.observe(containerRef.current);

      let raf = 0;
      const start = performance.now();
      const loop_ = () => {
        program.uniforms.uTime.value = reduced.current ? 0 : (performance.now() - start) / 1000;
        renderer.render({ scene: mesh });
        raf = requestAnimationFrame(loop_);
      };

      let first = await loadTexture(indexRef.current);
      if (!first && indexRef.current !== 0) first = await loadTexture(0);

      if (disposed) return;
      if (first) {
        program.uniforms.uFrom.value = first;
        program.uniforms.uTo.value = first;
        program.uniforms.uFromSize.value = first.__size;
        program.uniforms.uToSize.value = first.__size;
      }
      program.uniforms.uProgress.value = 1;
      raf = requestAnimationFrame(loop_);
      // Only hide the plain <img> once a real texture is on screen; otherwise WebGL would
      // paint an empty canvas over a perfectly loadable picture.
      setReady(Boolean(first));


      ctx = {
        gsap,
        program,
        loadTexture,
        textures,
        dispose: () => {
          cancelAnimationFrame(raf);
          ro.disconnect();
          gsap.killTweensOf(program.uniforms.uProgress);
          textures.forEach((t) => {
            try {
              t && gl.deleteTexture(t.texture);
            } catch {
              /* ignore */
            }
          });
          const lose = gl.getExtension("WEBGL_lose_context");
          if (lose) lose.loseContext();
        },
      };
      glRef.current = ctx;
    })();

    return () => {
      disposed = true;
      if (ctx) ctx.dispose();
      glRef.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slides, transition]);

  /* keep look-and-feel uniforms live */
  useEffect(() => {
    const ctx = glRef.current;
    if (!ctx) return;
    ctx.program.uniforms.uIntensity.value = intensity;
    ctx.program.uniforms.uAberration.value = aberration;
    ctx.program.uniforms.uDrift.value = drift;
  }, [intensity, aberration, drift, ready]);

  const goTo = useCallback(
    async (next) => {
      if (!slides.length) return;
      let target = next;
      if (target < 0 || target > slides.length - 1) {
        if (!loop) return;
        target = (target + slides.length) % slides.length;
      }
      if (target === indexRef.current || animatingRef.current) return;

      const ctx = glRef.current;
      indexRef.current = target;
      setIndex(target);
      onSlideChange?.(target);
      if (!ctx) return;

      const tex = await ctx.loadTexture(target);
      if (!tex || !glRef.current) return;
      const u = ctx.program.uniforms;
      const current = u.uTo.value;
      u.uFrom.value = current;
      u.uFromSize.value = current?.__size || [1, 1];
      u.uTo.value = tex;
      u.uToSize.value = tex.__size;
      u.uProgress.value = 0;

      animatingRef.current = true;
      if (reduced.current) {
        u.uProgress.value = 1;
        animatingRef.current = false;
        return;
      }
      ctx.gsap.to(u.uProgress, {
        value: 1,
        duration: 1.1,
        ease: "power2.inOut",
        onComplete: () => {
          animatingRef.current = false;
        },
      });
    },
    [slides.length, loop, onSlideChange],
  );

  const next = useCallback(() => goTo(indexRef.current + 1), [goTo]);
  const prev = useCallback(() => goTo(indexRef.current - 1), [goTo]);

  /* autoplay */
  useEffect(() => {
    if (!autoplay || slides.length < 2 || reduced.current) return;
    const id = setInterval(() => {
      if (!hoverRef.current && !document.hidden) next();
    }, Math.max(1.5, autoplayDelay) * 1000);
    return () => clearInterval(id);
  }, [autoplay, autoplayDelay, next, slides.length]);

  /* drag / swipe */
  const dragStart = useRef(null);
  const onPointerDown = (e) => {
    dragStart.current = e.clientX;
  };
  const onPointerUp = (e) => {
    if (dragStart.current == null) return;
    const dx = e.clientX - dragStart.current;
    dragStart.current = null;
    if (Math.abs(dx) > 45) (dx < 0 ? next : prev)();
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      next();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      prev();
    }
  };

  if (!slides.length) return null;
  const active = slides[index] ?? slides[0];

  return (
    <div
      ref={containerRef}
      className={`morph-slider ${className}`}
      style={{ borderRadius: `${radius}px`, aspectRatio: String(aspect) }}
      role="region"
      aria-roledescription="carousel"
      aria-label="Product mock showcase"
      tabIndex={0}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={() => (dragStart.current = null)}
      onMouseEnter={() => (hoverRef.current = true)}
      onMouseLeave={() => (hoverRef.current = false)}
    >
      <canvas ref={canvasRef} className="morph-slider__canvas" aria-hidden="true" />
      {!ready && (
        <img
          src={active.image}
          alt={active.caption || ""}
          className="morph-slider__fallback"
          style={{ objectFit: fit === "contain" ? "contain" : "cover" }}
        />
      )}
      <div className="morph-slider__veil" />

      {showCaptions && active.caption && (
        <div className="morph-slider__caption">{active.caption}</div>
      )}

      {showControls && slides.length > 1 && (
        <div className="morph-slider__controls">
          <button type="button" className="morph-slider__btn" onClick={prev} aria-label="Previous image">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button type="button" className="morph-slider__btn" onClick={next} aria-label="Next image">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {showIndicators && slides.length > 1 && (
        <div className="morph-slider__indicators">
          {slides.map((s, i) => (
            <button
              key={`${s.image}-${i}`}
              type="button"
              className="morph-slider__dot"
              data-active={i === index}
              aria-label={`Go to image ${i + 1}`}
              aria-current={i === index}
              onClick={() => goTo(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default MorphSlider;
