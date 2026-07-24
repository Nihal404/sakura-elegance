import { useRouterState } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";

export function TopProgressBar() {
  const isLoading = useRouterState({ select: (s) => s.isLoading || s.isTransitioning });

  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          key="top-progress"
          className="fixed top-0 left-0 right-0 z-[100] h-[3px] pointer-events-none overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="h-full bg-gradient-to-r from-primary via-sakura to-primary"
            style={{ backgroundSize: "200% 100%" }}
            initial={{ width: "0%", backgroundPosition: "0% 0%" }}
            animate={{
              width: ["0%", "60%", "85%", "95%"],
              backgroundPosition: ["0% 0%", "100% 0%"],
            }}
            transition={{
              width: { duration: 2.4, ease: [0.22, 1, 0.36, 1] },
              backgroundPosition: { duration: 1.5, repeat: Infinity, ease: "linear" },
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
