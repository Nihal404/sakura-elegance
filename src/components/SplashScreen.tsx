import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

export function SplashScreen() {
  const [show, setShow] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem("zari_splash_seen")) {
      setShow(false);
      return;
    }
    const t = setTimeout(() => {
      sessionStorage.setItem("zari_splash_seen", "1");
      setShow(false);
    }, 2600);
    return () => clearTimeout(t);
  }, []);

  const petals = Array.from({ length: 14 });

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.8, ease: "easeInOut" } }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-sakura-gradient overflow-hidden"
        >
          {/* Floating petals */}
          {petals.map((_, i) => {
            const left = (i * 37) % 100;
            const delay = (i % 7) * 0.15;
            const duration = 3 + (i % 4);
            const size = 10 + (i % 5) * 4;
            return (
              <motion.span
                key={i}
                initial={{ y: -40, x: 0, opacity: 0, rotate: 0 }}
                animate={{
                  y: ["-10%", "110%"],
                  x: [0, i % 2 ? 40 : -40, 0],
                  opacity: [0, 1, 1, 0],
                  rotate: [0, 180, 360],
                }}
                transition={{
                  duration,
                  delay,
                  ease: "easeInOut",
                  repeat: Infinity,
                }}
                className="absolute rounded-full"
                style={{
                  left: `${left}%`,
                  width: size,
                  height: size,
                  background:
                    "radial-gradient(circle at 30% 30%, oklch(0.92 0.06 15), oklch(0.78 0.12 15))",
                  boxShadow: "0 4px 10px oklch(0.75 0.12 15 / 0.35)",
                }}
              />
            );
          })}

          {/* Center brand */}
          <div className="relative flex flex-col items-center text-center px-6">
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
              className="relative"
            >
              {/* Blooming circle */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.2, 1] }}
                transition={{ duration: 1.4, ease: "easeOut" }}
                className="absolute inset-0 -m-10 rounded-full blur-2xl"
                style={{
                  background:
                    "radial-gradient(circle, oklch(0.85 0.08 15 / 0.6), transparent 70%)",
                }}
              />
              <motion.h1
                initial={{ letterSpacing: "0.5em", opacity: 0 }}
                animate={{ letterSpacing: "0.02em", opacity: 1 }}
                transition={{ duration: 1.2, ease: "easeOut", delay: 0.2 }}
                className="relative font-serif text-5xl md:text-7xl"
              >
                <span className="text-gradient-rose">Zari</span>
                <span className="text-foreground ml-2">Boutique</span>
              </motion.h1>
            </motion.div>

            <motion.div
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              transition={{ duration: 1, delay: 1, ease: "easeOut" }}
              className="mt-6 h-px w-40 origin-center bg-gradient-to-r from-transparent via-primary to-transparent"
            />

            <motion.p
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.8, delay: 1.2 }}
              className="mt-4 text-xs md:text-sm tracking-[0.4em] uppercase text-muted-foreground"
            >
              Elegance Blooms Here
            </motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
