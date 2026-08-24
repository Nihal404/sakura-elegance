import { useMemo } from "react";

interface Petal {
  id: number;
  left: number;
  size: number;
  duration: number;
  delay: number;
  opacity: number;
}

export function SakuraPetals() {
  const petals = useMemo<Petal[]>(() => {
    return Array.from({ length: 24 }, (_, i) => ({
      id: i,
      left: Math.random() * 100, // percentage across screen
      size: Math.random() * 12 + 10, // 10px - 22px
      duration: Math.random() * 14 + 10, // 10s - 24s
      delay: Math.random() * 10, // 0s - 10s
      opacity: Math.random() * 0.45 + 0.35, // 0.35 - 0.8
    }));
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
      {petals.map((p) => (
        <div
          key={p.id}
          className="absolute animate-sakura-fall rounded-full bg-gradient-to-tr from-sakura via-primary/60 to-rose-gold/50 shadow-sm"
          style={{
            left: `${p.left}%`,
            width: `${p.size}px`,
            height: `${p.size * 1.3}px`,
            borderRadius: "60% 40% 70% 30% / 50% 60% 40% 50%",
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
            opacity: p.opacity,
            filter: "blur(0.5px)",
          }}
        />
      ))}
    </div>
  );
}
