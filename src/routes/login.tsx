import { createFileRoute, useRouter } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import {
  AlertCircle,
  Mail,
  Lock,
  Sparkles,
  Loader2,
  ShieldCheck,
  Smartphone,
  User as UserIcon,
  KeyRound,
  ArrowLeft,
  Check,
  FlaskConical,
} from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
// TEMPORARY testing auth — delete this import and the block marked "TEST AUTH" below
// once production email is configured.
import { TEST_AUTH_ENABLED } from "@/lib/zari/test-auth";

type Mode = "signin" | "signup";
type Step = 1 | 2 | 3;

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>): { next?: string } =>
    typeof s.next === "string" && s.next.startsWith("/") && !s.next.startsWith("//")
      ? { next: s.next }
      : {},
  head: () => ({
    meta: [
      { title: "Sign in — Zari Boutique" },
      {
        name: "description",
        content:
          "Sign in to your Zari Boutique account to manage your bag, track orders and discover elegant Sakura-inspired clothing and accessories.",
      },
      { property: "og:title", content: "Sign in — Zari Boutique" },
      {
        property: "og:description",
        content:
          "Sign in to your Zari Boutique account to manage your bag, track orders and discover elegant Sakura-inspired clothing and accessories.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Login,
});

const inputClass =
  "w-full pl-11 pr-4 py-3.5 rounded-full bg-blush/60 border border-border focus:border-primary focus:bg-background outline-none transition-all";

const STEP_LABELS: Record<Step, string> = {
  1: "Your details",
  2: "Verify email",
  3: "Set password",
};

function Login() {
  const router = useRouter();
  const { next } = Route.useSearch();
  const { signIn, sendSignupOtp, verifySignupOtp, completeSignup, signInAsTestUser, user } =
    useStore();

  const [mode, setMode] = useState<Mode>("signin");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState("");

  const [signinEmail, setSigninEmail] = useState("");
  const [signinPassword, setSigninPassword] = useState("");

  // Account creation wizard
  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [done, setDone] = useState(false);

  const goNext = () => {
    const target = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
    router.navigate({ to: target, replace: true });
  };

  // ---- TEST AUTH (temporary) -------------------------------------------------
  const handleTestUser = async () => {
    if (loading) return;
    setLoading(true);
    setFormError("");
    try {
      await signInAsTestUser();
      toast.success("Signed in as a test user 🌸");
      goNext();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not start a test session.";
      setFormError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };
  // ---- end TEST AUTH ---------------------------------------------------------

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setFormError("");
    try {
      await signIn(signinEmail, signinPassword);
      toast.success("Welcome back to Zari 🌸");
      goNext();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Sign in failed.";
      setFormError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // Step 1 — name + email, sends the code
  const handleDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (name.trim().length < 2) {
      setFormError("Please enter your name.");
      return;
    }
    setLoading(true);
    setFormError("");
    try {
      await sendSignupOtp({
        email,
        fullName: name.trim(),
        phone: phone.trim() || undefined,
      });
      setStep(2);
      toast.success("We sent a 6-digit code to your email.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not send your code.";
      setFormError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // Step 2 — verify the emailed code
  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (code.trim().length < 6) {
      setFormError("Enter the 6-digit code from your email.");
      return;
    }
    setLoading(true);
    setFormError("");
    try {
      await verifySignupOtp({ email, code });
      setStep(3);
      toast.success("Email verified 🌸");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not verify your code.";
      setFormError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (loading) return;
    setLoading(true);
    setFormError("");
    try {
      await sendSignupOtp({ email, fullName: name.trim(), phone: phone.trim() || undefined });
      toast.success("New code sent.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not resend the code.";
      setFormError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // Step 3 — create + confirm the password
  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (password.length < 8) {
      setFormError("Please use a password with at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setFormError("Both passwords need to match.");
      return;
    }
    setLoading(true);
    setFormError("");
    try {
      await completeSignup({
        password,
        fullName: name.trim(),
        phone: phone.trim() || undefined,
      });
      setDone(true);
      toast.success("Your Zari account is ready 🌸");
      goNext();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not save your password.";
      setFormError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const stepper = (
    <div className="mb-6">
      <div className="flex items-center gap-2">
        {([1, 2, 3] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2 flex-1 last:flex-none">
            <div
              className={`w-7 h-7 shrink-0 rounded-full text-xs inline-flex items-center justify-center border transition-all ${
                step > s
                  ? "bg-primary text-primary-foreground border-primary"
                  : step === s
                    ? "bg-background text-foreground border-primary shadow-soft"
                    : "bg-blush/60 text-muted-foreground border-border"
              }`}
            >
              {step > s ? <Check className="w-3.5 h-3.5" /> : s}
            </div>
            {i < 2 && (
              <div
                className={`h-px flex-1 ${step > s ? "bg-primary" : "bg-border"} transition-colors`}
              />
            )}
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        Step {step} of 3 — {STEP_LABELS[step]}
      </p>
    </div>
  );

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-6 py-16 bg-sakura-gradient">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md rounded-3xl bg-background/95 backdrop-blur border border-border shadow-petal p-8 lg:p-10"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 justify-center w-12 h-12 rounded-full bg-sakura mb-4">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <h1 className="font-serif text-3xl">
            Welcome to <span className="font-zari">Zari</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-2 inline-flex items-center gap-1.5 justify-center">
            <ShieldCheck className="w-3.5 h-3.5 text-primary" />
            {mode === "signin" ? "Sign in to your account" : "Create your account"}
          </p>
        </div>

        {user && (mode === "signin" || done) ? (
          <div className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              You're signed in as <span className="text-foreground/80">{user.email}</span>.
            </p>
            <button
              onClick={goNext}
              className="w-full py-3.5 rounded-full bg-primary text-primary-foreground font-medium tracking-wide shadow-soft hover:shadow-petal transition-all"
            >
              Continue shopping
            </button>
          </div>
        ) : (
          <>
            <div className="flex p-1 rounded-full bg-blush/60 mb-6 text-sm">
              {(["signin", "signup"] as Mode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMode(m);
                    setFormError("");
                  }}
                  className={`flex-1 py-2 rounded-full transition-all ${
                    mode === m ? "bg-background shadow-soft text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {m === "signin" ? "Sign in" : "Create account"}
                </button>
              ))}
            </div>

            {mode === "signup" && stepper}

            {formError && (
              <div className="mb-4 flex gap-2 rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{formError}</p>
              </div>
            )}

            <AnimatePresence mode="wait">
              {mode === "signin" ? (
                <motion.form
                  key="signin"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  onSubmit={handleSignIn}
                  className="space-y-4"
                >
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      id="signin-email"
                      type="email"
                      autoComplete="email"
                      value={signinEmail}
                      aria-label="Email address"
                      onChange={(e) => setSigninEmail(e.target.value)}
                      placeholder="you@example.com"
                      className={inputClass}
                      required
                    />
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      id="signin-password"
                      type="password"
                      autoComplete="current-password"
                      value={signinPassword}
                      aria-label="Password"
                      onChange={(e) => setSigninPassword(e.target.value)}
                      placeholder="Password"
                      className={inputClass}
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
              ) : step === 1 ? (
                <motion.form
                  key="step1"
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  onSubmit={handleDetails}
                  className="space-y-4"
                >
                  <div className="relative">
                    <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      id="signup-name"
                      type="text"
                      value={name}
                      aria-label="Your name"
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name"
                      className={inputClass}
                      required
                    />
                  </div>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      id="signup-email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      aria-label="Email address"
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className={inputClass}
                      required
                    />
                  </div>
                  <div className="relative">
                    <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      id="signup-phone"
                      type="tel"
                      autoComplete="tel"
                      value={phone}
                      aria-label="Phone number (optional)"
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Phone (optional)"
                      className={inputClass}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 rounded-full bg-primary text-primary-foreground font-medium tracking-wide shadow-soft hover:shadow-petal transition-all disabled:opacity-60 inline-flex items-center justify-center gap-2"
                  >
                    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                    Send verification code
                  </button>
                  <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
                    One account per email. We'll email you a 6-digit code to verify it.
                  </p>
                </motion.form>
              ) : step === 2 ? (
                <motion.form
                  key="step2"
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  onSubmit={handleVerify}
                  className="space-y-4"
                >
                  <p className="text-sm text-muted-foreground text-center leading-relaxed">
                    Enter the 6-digit code we sent to{" "}
                    <span className="text-foreground/80">{email.trim().toLowerCase()}</span>.
                  </p>
                  <div className="relative">
                    <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      id="signup-code"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      value={code}
                      aria-label="Verification code"
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                      placeholder="000000"
                      className={`${inputClass} text-center tracking-[0.5em] font-mono`}
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 rounded-full bg-primary text-primary-foreground font-medium tracking-wide shadow-soft hover:shadow-petal transition-all disabled:opacity-60 inline-flex items-center justify-center gap-2"
                  >
                    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                    Verify code
                  </button>
                  <div className="flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setStep(1);
                        setFormError("");
                        setCode("");
                      }}
                      className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      Change email
                    </button>
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={loading}
                      className="text-primary hover:underline disabled:opacity-60"
                    >
                      Resend code
                    </button>
                  </div>
                </motion.form>
              ) : (
                <motion.form
                  key="step3"
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  onSubmit={handlePassword}
                  className="space-y-4"
                >
                  <p className="text-sm text-muted-foreground text-center leading-relaxed">
                    Last step — create a password for your Zari account.
                  </p>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      id="signup-password"
                      type="password"
                      autoComplete="new-password"
                      value={password}
                      aria-label="Password"
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Password (min. 8 characters)"
                      className={inputClass}
                      required
                    />
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      id="signup-confirm"
                      type="password"
                      autoComplete="new-password"
                      value={confirmPassword}
                      aria-label="Confirm password"
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm password"
                      className={inputClass}
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 rounded-full bg-primary text-primary-foreground font-medium tracking-wide shadow-soft hover:shadow-petal transition-all disabled:opacity-60 inline-flex items-center justify-center gap-2"
                  >
                    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                    Create account
                  </button>
                </motion.form>
              )}
            </AnimatePresence>

            {/* TEST AUTH (temporary): real anonymous Supabase session, no email sent. */}
            {TEST_AUTH_ENABLED && mode === "signin" && (
              <div className="mt-6 pt-6 border-t border-border">
                <p className="text-[11px] uppercase tracking-widest text-muted-foreground text-center mb-3">
                  Testing only
                </p>
                <button
                  type="button"
                  onClick={handleTestUser}
                  disabled={loading}
                  className="w-full py-3.5 rounded-full border border-primary/40 bg-blush/50 text-foreground font-medium tracking-wide hover:bg-blush transition-all disabled:opacity-60 inline-flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  <FlaskConical className="w-4 h-4 text-primary" />
                  Continue as Test User
                </button>
                <p className="text-[11px] text-muted-foreground text-center mt-2 leading-relaxed">
                  Temporary guest session for testing — no email needed. Customer access only.
                </p>
              </div>
            )}
            {/* end TEST AUTH */}
          </>
        )}
      </motion.div>
    </div>
  );
}
