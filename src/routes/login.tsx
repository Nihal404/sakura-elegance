import { createFileRoute, useRouter } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useState } from "react";
import { Mail, Lock, Sparkles, Loader2, KeyRound, User, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { ensureAdminAccount } from "@/lib/admin-provision.functions";
import { signUpUser, startLogin, verifyLoginOtp } from "@/lib/otp.functions";

const ADMIN_EMAIL = "admin@zariboutique.com";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — Zari Boutique" },
      { name: "description", content: "Sign in to Zari Boutique with 2-step verification." },
      { property: "og:title", content: "Sign in — Zari Boutique" },
      { property: "og:description", content: "Sign in to Zari Boutique with 2-step verification." },
    ],
  }),
  component: Login,
});

type Mode = "signin" | "signup";
type Step = "credentials" | "otp";

function Login() {
  const router = useRouter();
  const provisionAdmin = useServerFn(ensureAdminAccount);
  const signUpFn = useServerFn(signUpUser);
  const startLoginFn = useServerFn(startLogin);
  const verifyOtpFn = useServerFn(verifyLoginOtp);

  const [mode, setMode] = useState<Mode>("signin");
  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

  const submitCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) return;
    setLoading(true);
    try {
      if (cleanEmail === ADMIN_EMAIL) {
        // Ensure the admin account exists with the seeded password before signing in.
        await provisionAdmin();
      }
      if (mode === "signup") {
        await signUpFn({ data: { email: cleanEmail, password, name: name.trim() || undefined } });
        toast.success("Account created. Check your email for the 6-digit code.");
      } else {
        await startLoginFn({ data: { email: cleanEmail, password } });
        toast.success("Password verified. Check your email for the 6-digit code.");
      }
      setStep("otp");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const submitOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) {
      toast.error("Enter the 6-digit code.");
      return;
    }
    setLoading(true);
    try {
      const cleanEmail = email.trim().toLowerCase();
      const { token_hash } = await verifyOtpFn({ data: { email: cleanEmail, code: otp } });
      const { error } = await supabase.auth.verifyOtp({ type: "email", token_hash });
      if (error) throw error;
      toast.success("Welcome to Zari!");
      router.navigate({ to: cleanEmail === ADMIN_EMAIL ? "/admin" : "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid code");
    } finally {
      setLoading(false);
    }
  };

  const resetToStart = () => {
    setStep("credentials");
    setOtp("");
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
          <p className="text-sm text-muted-foreground mt-2 inline-flex items-center gap-1.5 justify-center">
            <ShieldCheck className="w-3.5 h-3.5 text-primary" />
            2-step verification — password + email code
          </p>
        </div>

        {/* Sign-in / Sign-up toggle */}
        {step === "credentials" && (
          <div className="flex p-1 rounded-full bg-blush/60 mb-6 text-sm">
            <button
              type="button"
              onClick={() => setMode("signin")}
              className={`flex-1 py-2 rounded-full transition-all ${mode === "signin" ? "bg-background shadow-soft text-foreground" : "text-muted-foreground"}`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`flex-1 py-2 rounded-full transition-all ${mode === "signup" ? "bg-background shadow-soft text-foreground" : "text-muted-foreground"}`}
            >
              Create account
            </button>
          </div>
        )}

        {step === "credentials" && (
          <form onSubmit={submitCredentials} className="space-y-4">
            {mode === "signup" && (
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name (optional)"
                  className="w-full pl-11 pr-4 py-3.5 rounded-full bg-blush/60 border border-border focus:border-primary focus:bg-background outline-none transition-all"
                />
              </div>
            )}
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
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === "signup" ? "Create a password (min 8 characters)" : "Your password"}
                className="w-full pl-11 pr-4 py-3.5 rounded-full bg-blush/60 border border-border focus:border-primary focus:bg-background outline-none transition-all"
                minLength={mode === "signup" ? 8 : undefined}
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-full bg-primary text-primary-foreground font-medium tracking-wide shadow-soft hover:shadow-petal transition-all disabled:opacity-60 inline-flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {mode === "signup" ? "Create account & send code" : "Continue — send code"}
            </button>
          </form>
        )}

        {step === "otp" && (
          <form onSubmit={submitOtp} className="space-y-4">
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
              onClick={resetToStart}
              className="w-full text-xs text-muted-foreground hover:text-primary"
            >
              Back — use a different email or password
            </button>
          </form>
        )}

        <p className="mt-6 text-[11px] text-center text-muted-foreground/80 bg-blush/60 rounded-xl py-2 px-3">
          Every sign-in requires your password and a fresh code emailed to you.
        </p>
      </motion.div>
    </div>
  );
}
