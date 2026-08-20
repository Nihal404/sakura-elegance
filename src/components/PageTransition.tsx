import { motion, AnimatePresence, type Transition, type Variants } from "framer-motion";
import { useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";

const EASE = [0.22, 1, 0.36, 1] as const;

const spring: Transition = { duration: 0.5, ease: EASE };

/** Distinct motion signatures per section so navigation reads as movement, not a blink. */
const variantsFor = (pathname: string): Variants => {
  if (pathname === "/") {
    // Home: gentle bloom
    return {
      initial: { opacity: 0, scale: 0.985, y: 10 },
      animate: { opacity: 1, scale: 1, y: 0 },
      exit: { opacity: 0, scale: 1.01, y: -6 },
    };
  }
  if (pathname.startsWith("/product/")) {
    // Product details: lift forward, as if the card opened up
    return {
      initial: { opacity: 0, scale: 0.96, y: 24 },
      animate: { opacity: 1, scale: 1, y: 0 },
      exit: { opacity: 0, scale: 0.98, y: 14 },
    };
  }
  if (pathname.startsWith("/shop")) {
    // Shop: slide in from the right
    return {
      initial: { opacity: 0, x: 28 },
      animate: { opacity: 1, x: 0 },
      exit: { opacity: 0, x: -20 },
    };
  }
  if (pathname.startsWith("/login")) {
    // Login: soft focus-in
    return {
      initial: { opacity: 0, y: 18, filter: "blur(6px)" },
      animate: { opacity: 1, y: 0, filter: "blur(0px)" },
      exit: { opacity: 0, y: -10, filter: "blur(4px)" },
    };
  }
  if (pathname.startsWith("/admin")) {
    // Admin: crisp panel slide up
    return {
      initial: { opacity: 0, y: 26 },
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: -14 },
    };
  }
  return {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -8 },
  };
};

export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const variants = variantsFor(pathname);

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        variants={variants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={spring}
        className="will-change-transform"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
