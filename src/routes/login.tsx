import { createFileRoute, useRouter } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useState } from "react";
import { Mail, Lock, Sparkles, Loader2, KeyRound, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { ensureAdminAccount } from "@/lib/admin-provision.functions";

const ADMIN_EMAIL = "admin@zariboutique.com";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — Zari Boutique" },
      { name: "description", content: "Sign in to your Zari Boutique account with a one-time code." },
      { property: "og:title", content: "Sign in — Zari Boutique" },
      { property: "og:description", content: "Sign in to your Zari Boutique account with a one-time code." },
    ],
  }),
  component: Login,
});

type Tab = "customer" | "admin";
type Step = "email" | "otp";

function Login() {
  const router = useRouter();
  const provisionAdmin = useServerFn(ensureAdminAccount);

  const [tab, setTab] = useState<Tab>("customer");
  // customer OTP flow
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  // admin
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const sendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = email.trim().toLowerCase();
    if (!clean) return;
    if (clean === ADMIN_EMAIL) {
      toast.error("Admin uses password sign-in. Switch to the Admin tab.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: clean,
        options: { shouldCreateUser: true },
      });
      if (error) throw error;
      toast.success("Check your inbox for a 6-digit code.");
      setStep("otp");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send code");
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) {
      toast.error("Enter the 6-digit code.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: otp,
        type: "email",
      });
      if (error) throw error;
      toast.success("Welcome to Zari!");
      router.navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid code");
    } finally {
      setLoading(false);
    }
  };

  const adminSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminPassword) return;
    setLoading(true);
    try {
      // Idempotently provision admin (safe to call every time)
      await provisionAdmin();
      const { error } = await supabase.auth.signInWithPassword({
        email: ADMIN_EMAIL,
        password: adminPassword,
      });
      if (error) throw error;
      toast.success("Welcome, Admin.");
      router.navigate({ to: "/admin" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Admin sign-in failed");
    } finally {
      setLoading(false);
    }
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
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 justify-center w-12 h-12 rounded-full bg-sakura mb-4">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <h1 className="font-serif text-3xl">Welcome to Zari</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Sign in with a one-time code — no password to remember.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex p-1 rounded-full bg-blush/60 mb-6 text-sm">
          <button
            type="button"
            onClick={() => { setTab("customer"); setStep("email"); }}
            className={`flex-1 py-2 rounded-full transition-all ${tab === "customer" ? "bg-background shadow-soft text-foreground" : "text-muted-foreground"}`}
          >
            Customer
          </button>
          <button
            type="button"
            onClick={() => setTab("admin")}
            className={`flex-1 py-2 rounded-full transition-all inline-flex items-center justify-center gap-1.5 ${tab === "admin" ? "bg-background shadow-soft text-foreground" : "text-muted-foreground"}`}
          >
            <ShieldCheck className="w-3.5 h-3.5" /> Admin
          </button>
        </div>

        {tab === "customer" && step === "email" && (
          <form onSubmit={sendOtp} className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full pl-11 pr-4 py-3.5 rounded-full bg-blush/60 border border-border focus:border-primary focus:bg-background outline-none transition-all"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-full bg-primary text-primary-foreground font-medium tracking-wide shadow-soft hover:shadow-petal transition-all disabled:opacity-60 inline-flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Send one-time code
            </button>
          </form>
        )}

        {tab === "customer" && step === "otp" && (
          <form onSubmit={verifyOtp} className="space-y-4">
            <p className="text-xs text-center text-muted-foreground">
              Enter the 6-digit code sent to <span className="font-medium text-foreground">{email}</span>
            </p>
            <div className="relative">
              <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                placeholder="123456"
                className="w-full pl-11 pr-4 py-3.5 rounded-full bg-blush/60 border border-border focus:border-primary focus:bg-background outline-none transition-all tracking-[0.5em] text-center font-mono"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-full bg-primary text-primary-foreground font-medium tracking-wide shadow-soft hover:shadow-petal transition-all disabled:opacity-60 inline-flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Verify & sign in
            </button>
            <button
              type="button"
              onClick={() => { setStep("email"); setOtp(""); }}
              className="w-full text-xs text-muted-foreground hover:text-primary"
            >
              Use a different email
            </button>
          </form>
        )}

        {tab === "admin" && (
          <form onSubmit={adminSignIn} className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="email"
                value=""
                readOnly
                placeholder="Admin email"
                className="w-full pl-11 pr-4 py-3.5 rounded-full bg-blush/40 border border-border text-muted-foreground"
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="Admin password"
                className="w-full pl-11 pr-4 py-3.5 rounded-full bg-blush/60 border border-border focus:border-primary focus:bg-background outline-none transition-all"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-full bg-primary text-primary-foreground font-medium tracking-wide shadow-soft hover:shadow-petal transition-all disabled:opacity-60 inline-flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Sign in as Admin
            </button>
          </form>
        )}

        <p className="mt-6 text-[11px] text-center text-muted-foreground/80 bg-blush/60 rounded-xl py-2 px-3">
          Customers sign in with a one-time code. Admin uses a preset strong password.
        </p>
      </motion.div>
    </div>
  );
}
