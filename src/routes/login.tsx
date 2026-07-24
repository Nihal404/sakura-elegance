import { createFileRoute, useRouter } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useState } from "react";
import { Mail, Lock, Sparkles } from "lucide-react";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — Zari Boutique" },
      { name: "description", content: "Sign in to your Zari Boutique account." },
      { property: "og:title", content: "Sign in — Zari Boutique" },
      { property: "og:description", content: "Sign in to your Zari Boutique account." },
    ],
  }),
  component: Login,
});

function Login() {
  const { login } = useStore();
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    const u = login(email);
    router.navigate({ to: u.role === "Admin" ? "/admin" : "/" });
  };

  return (
    <div className="relative min-h-[calc(100vh-5rem)] flex items-center justify-center px-6 py-14 overflow-hidden">
      <div className="absolute inset-0 bg-sakura-gradient" />
      <img
        src="https://images.unsplash.com/photo-1522383225653-ed111181a951?w=1600&q=80"
        alt=""
        className="absolute inset-0 w-full h-full object-cover opacity-20 mix-blend-multiply"
      />

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="relative w-full max-w-md bg-background/95 backdrop-blur-xl rounded-3xl shadow-petal border border-border/50 p-8 md:p-10"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 justify-center w-12 h-12 rounded-full bg-sakura mb-4">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <h1 className="font-serif text-3xl">
            {mode === "signin" ? "Welcome back" : "Join Zari"}
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            {mode === "signin"
              ? "Sign in to continue your journey."
              : "Create your account to unlock the collection."}
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@zariboutique.com"
              className="w-full pl-11 pr-4 py-3.5 rounded-full bg-blush/60 border border-border focus:border-primary focus:bg-background outline-none transition-all"
              required
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full pl-11 pr-4 py-3.5 rounded-full bg-blush/60 border border-border focus:border-primary focus:bg-background outline-none transition-all"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full py-3.5 rounded-full bg-primary text-primary-foreground font-medium tracking-wide shadow-soft hover:shadow-petal transition-all"
          >
            {mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <p className="text-center text-xs text-muted-foreground mt-6">
          {mode === "signin" ? "New to Zari?" : "Already have an account?"}{" "}
          <button
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="text-primary hover:underline"
          >
            {mode === "signin" ? "Create an account" : "Sign in"}
          </button>
        </p>

        <p className="mt-6 text-[11px] text-center text-muted-foreground/80 bg-blush/60 rounded-xl py-2 px-3">
          Admin demo: <span className="font-medium">admin@zariboutique.com</span>
        </p>
      </motion.div>
    </div>
  );
}
