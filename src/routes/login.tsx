import { createFileRoute, useRouter } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Mail,
  Lock,
  Sparkles,
  Loader2,
  KeyRound,
  ShieldCheck,
  Smartphone,
  User as UserIcon,
  MessageCircle,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { ensureAdminAccount } from "@/lib/admin-provision.functions";
import { signUpUser, verifySignupOtp, cancelPendingSignup, finalizeEmailSignup } from "@/lib/otp.functions";

const ADMIN_EMAIL = "admin@zariboutique.com";

type Mode = "signin" | "signup";
type SignupStep = "form" | "otp";
type Channel = "email" | "whatsapp";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — Zari Boutique" },
      { name: "description", content: "Sign in or create your Zari Boutique account." },
      { property: "og:title", content: "Sign in — Zari Boutique" },
      { property: "og:description", content: "Sign in or create your Zari Boutique account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Login,
});

function Login() {
  const router = useRouter();
  const provisionAdmin = useServerFn(ensureAdminAccount);
  const doSignUp = useServerFn(signUpUser);
  const doVerifySignup = useServerFn(verifySignupOtp);
  const doCancelSignup = useServerFn(cancelPendingSignup);
  const doFinalizeEmail = useServerFn(finalizeEmailSignup);

  const [mode, setMode] = useState<Mode>("signin");
  const [signupStep, setSignupStep] = useState<SignupStep>("form");
  const [channel, setChannel] = useState<Channel>("email");

  // Sign in state
  const [signinEmail, setSigninEmail] = useState("");
  const [signinPassword, setSigninPassword] = useState("");

  // Sign up state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");

  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState("");

  const isAdmin = signinEmail.trim().toLowerCase() === ADMIN_EMAIL;
  const pendingEmailRef = useRef<string>("");
  const verifiedRef = useRef(false);

  // If the user navigates away or closes the tab while on the OTP step
  // without verifying, delete the pending (unverified) account.
  useEffect(() => {
    const cleanup = () => {
      const pending = pendingEmailRef.current;
      if (!pending || verifiedRef.current) return;
      // Fire-and-forget; if it fails we can't do anything from here.
      doCancelSignup({ data: { email: pending } }).catch(() => {});
    };
    const onBeforeUnload = () => cleanup();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      cleanup();
    };
  }, [doCancelSignup]);


  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFormError("");
    try {
      const cleanEmail = signinEmail.trim().toLowerCase();
      if (isAdmin) {
        await provisionAdmin();
      }
      const { error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: signinPassword,
      });
      if (error) {
        const msg =
          error.message.toLowerCase().includes("email not confirmed")
            ? "Please verify your email first. Create an account to receive a new code."
            : "Invalid email or password.";
        setFormError(msg);
        toast.error(msg);
        return;
      }
      toast.success(isAdmin ? "Welcome, admin!" : "Welcome back!");
      router.navigate({ to: isAdmin ? "/admin" : "/" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign in failed";
      setFormError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFormError("");
    try {
      const cleanEmail = email.trim().toLowerCase();
      const digits = phone.replace(/\D/g, "").replace(/^91/, "");
      if (!name.trim()) {
        setFormError("Enter your name.");
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        setFormError("Enter a valid email address.");
        return;
      }
      if (digits.length !== 10 || !/^[6-9]/.test(digits)) {
        setFormError("Enter a valid 10-digit Indian mobile number.");
        return;
      }
      if (password.length < 8) {
        setFormError("Password must be at least 8 characters.");
        return;
      }
      const result = await doSignUp({
        data: {
          email: cleanEmail,
          password,
          name: name.trim(),
          phone: `+91${digits}`,
          channel,
        },
      });
      if (!result.ok) {
        setFormError(result.error);
        toast.error(result.error);
        return;
      }
      if (channel === "email") {
        // Trigger Supabase's built-in email OTP (6-digit token).
        const { error: otpErr } = await supabase.auth.signInWithOtp({
          email: cleanEmail,
          options: { shouldCreateUser: false },
        });
        if (otpErr) {
          setFormError(otpErr.message);
          toast.error(otpErr.message);
          return;
        }
        toast.success("Code sent to your email.");
      } else {
        toast.success("Code sent — check WhatsApp.");
      }
      setSignupStep("otp");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not create account";
      setFormError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifySignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) {
      toast.error("Enter the 6-digit code.");
      return;
    }
    setLoading(true);
    setFormError("");
    try {
      const cleanEmail = email.trim().toLowerCase();
      if (channel === "email") {
        // Verify with Supabase's built-in email OTP — signs the user in and
        // marks the email as confirmed in one call.
        const { error } = await supabase.auth.verifyOtp({
          email: cleanEmail,
          token: otp,
          type: "email",
        });
        if (error) {
          setFormError(error.message);
          toast.error(error.message);
          return;
        }
        // Clear the pending_verification flag on the user record.
        await doFinalizeEmail({ data: { email: cleanEmail } }).catch(() => {});
        toast.success("Welcome to Zari!");
        router.navigate({ to: "/" });
        return;
      }
      // WhatsApp channel: verify custom code server-side, then sign in with password.
      const result = await doVerifySignup({ data: { email: cleanEmail, code: otp } });
      if (!result.ok) {
        setFormError(result.error);
        toast.error(result.error);
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });
      if (error) {
        toast.success("Verified! Please sign in.");
        setMode("signin");
        setSigninEmail(cleanEmail);
        setSignupStep("form");
        return;
      }
      toast.success("Welcome to Zari!");
      router.navigate({ to: "/" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Verification failed";
      setFormError(message);
      toast.error(message);
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
          <p className="text-sm text-muted-foreground mt-2 inline-flex items-center gap-1.5 justify-center">
            <ShieldCheck className="w-3.5 h-3.5 text-primary" />
            {mode === "signin" ? "Sign in to your account" : "Create your account"}
          </p>
        </div>

        {/* Mode switch */}
        {signupStep === "form" && (
          <div className="flex p-1 rounded-full bg-blush/60 mb-6 text-sm">
            <button
              type="button"
              onClick={() => {
                setMode("signin");
                setFormError("");
              }}
              className={`flex-1 py-2 rounded-full transition-all ${mode === "signin" ? "bg-background shadow-soft text-foreground" : "text-muted-foreground"}`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("signup");
                setFormError("");
              }}
              className={`flex-1 py-2 rounded-full transition-all ${mode === "signup" ? "bg-background shadow-soft text-foreground" : "text-muted-foreground"}`}
            >
              Create account
            </button>
          </div>
        )}

        <AnimatePresence mode="wait">
          {mode === "signin" && (
            <motion.form
              key="signin"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              onSubmit={handleSignIn}
              className="space-y-4"
            >
              {formError && (
                <div className="flex gap-2 rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>{formError}</p>
                </div>
              )}
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="email"
                  value={signinEmail}
                  onChange={(e) => setSigninEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-11 pr-4 py-3.5 rounded-full bg-blush/60 border border-border focus:border-primary focus:bg-background outline-none transition-all"
                  required
                />
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="password"
                  value={signinPassword}
                  onChange={(e) => setSigninPassword(e.target.value)}
                  placeholder="Password"
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
                Sign in
              </button>
            </motion.form>
          )}

          {mode === "signup" && signupStep === "form" && (
            <motion.form
              key="signup"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              onSubmit={handleSignUp}
              className="space-y-4"
            >
              {formError && (
                <div className="flex gap-2 rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>{formError}</p>
                </div>
              )}
              <div className="relative">
                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="w-full pl-11 pr-4 py-3.5 rounded-full bg-blush/60 border border-border focus:border-primary focus:bg-background outline-none transition-all"
                  required
                />
              </div>
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
                <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <div className="absolute left-11 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">
                  +91
                </div>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  placeholder="9876543210"
                  maxLength={10}
                  className="w-full pl-20 pr-4 py-3.5 rounded-full bg-blush/60 border border-border focus:border-primary focus:bg-background outline-none transition-all tracking-wide"
                  required
                />
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password (min 8 chars)"
                  className="w-full pl-11 pr-4 py-3.5 rounded-full bg-blush/60 border border-border focus:border-primary focus:bg-background outline-none transition-all"
                  required
                  minLength={8}
                />
              </div>

              <div className="flex p-1 rounded-full bg-blush/60 text-xs">
                <button
                  type="button"
                  onClick={() => setChannel("email")}
                  className={`flex-1 py-2 rounded-full inline-flex items-center justify-center gap-1.5 transition-all ${channel === "email" ? "bg-background shadow-soft text-foreground" : "text-muted-foreground"}`}
                >
                  <Mail className="w-3 h-3" /> Verify by email
                </button>
                <button
                  type="button"
                  onClick={() => setChannel("whatsapp")}
                  className={`flex-1 py-2 rounded-full inline-flex items-center justify-center gap-1.5 transition-all ${channel === "whatsapp" ? "bg-background shadow-soft text-foreground" : "text-muted-foreground"}`}
                >
                  <MessageCircle className="w-3 h-3" /> WhatsApp
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-full bg-primary text-primary-foreground font-medium tracking-wide shadow-soft hover:shadow-petal transition-all disabled:opacity-60 inline-flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Create account & send code
              </button>
            </motion.form>
          )}

          {mode === "signup" && signupStep === "otp" && (
            <motion.form
              key="otp"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              onSubmit={handleVerifySignup}
              className="space-y-4"
            >
              {formError && (
                <div className="flex gap-2 rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>{formError}</p>
                </div>
              )}
              <p className="text-xs text-center text-muted-foreground">
                Enter the 6-digit code sent to{" "}
                <span className="font-medium text-foreground">{email}</span>
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
                Verify & continue
              </button>
              <button
                type="button"
                onClick={() => {
                  setSignupStep("form");
                  setOtp("");
                  setFormError("");
                }}
                className="w-full text-xs text-muted-foreground hover:text-primary"
              >
                Back — edit details
              </button>
            </motion.form>
          )}
        </AnimatePresence>

        <p className="mt-6 text-[11px] text-center text-muted-foreground/80 bg-blush/60 rounded-xl py-2 px-3">
          {mode === "signin"
            ? "Don't have an account? Switch to Create account above."
            : "We'll send a one-time code to verify your email or WhatsApp."}
        </p>
      </motion.div>
    </div>
  );
}
