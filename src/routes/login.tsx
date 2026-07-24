import { createFileRoute, useRouter } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useState } from "react";
import {
  AlertCircle,
  Mail,
  Lock,
  Sparkles,
  Loader2,
  KeyRound,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { ensureAdminAccount } from "@/lib/admin-provision.functions";
import { sendPhoneLoginOtp, verifyPhoneLoginOtp } from "@/lib/otp.functions";

const ADMIN_EMAIL = "admin@zariboutique.com";

type Step = "identify" | "otp";
type Channel = "email" | "phone";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — Zari Boutique" },
      { name: "description", content: "Sign in to Zari Boutique with a secure one-time code." },
      { property: "og:title", content: "Sign in — Zari Boutique" },
      { property: "og:description", content: "Sign in to Zari Boutique with a secure one-time code." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Login,
});

function Login() {
  const router = useRouter();
  const provisionAdmin = useServerFn(ensureAdminAccount);
  const sendPhoneOtp = useServerFn(sendPhoneLoginOtp);
  const verifyPhoneOtp = useServerFn(verifyPhoneLoginOtp);

  const [step, setStep] = useState<Step>("identify");
  const [channel, setChannel] = useState<Channel>("email");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState("");

  const isAdmin = email.trim().toLowerCase() === ADMIN_EMAIL;

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFormError("");
    try {
      // Admin bypass: password sign-in, no OTP.
      if (channel === "email" && isAdmin) {
        if (!adminPassword) {
          setFormError("Enter the admin password.");
          return;
        }
        await provisionAdmin();
        const { error } = await supabase.auth.signInWithPassword({
          email: ADMIN_EMAIL,
          password: adminPassword,
        });
        if (error) {
          setFormError(error.message);
          toast.error(error.message);
          return;
        }
        toast.success("Welcome, admin!");
        router.navigate({ to: "/admin" });
        return;
      }

      if (channel === "email") {
        const cleanEmail = email.trim().toLowerCase();
        if (!cleanEmail) {
          setFormError("Enter your email.");
          return;
        }
        const { error } = await supabase.auth.signInWithOtp({
          email: cleanEmail,
          options: { shouldCreateUser: true },
        });
        if (error) throw error;
        toast.success("Check your email for the 6-digit code.");
      } else {
        const digits = phone.replace(/\D/g, "").replace(/^91/, "");
        if (digits.length !== 10 || !/^[6-9]/.test(digits)) {
          setFormError("Enter a valid 10-digit Indian mobile number.");
          return;
        }
        const result = await sendPhoneOtp({ data: { phone: digits } });
        if (!result.ok) {
          setFormError(result.error);
          toast.error(result.error);
          return;
        }
        toast.success("Code sent to the email linked to this phone.");
      }
      setStep("otp");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not send code";
      setFormError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) {
      toast.error("Enter the 6-digit code.");
      return;
    }
    setLoading(true);
    setFormError("");
    try {
      if (channel === "email") {
        const cleanEmail = email.trim().toLowerCase();
        const { error } = await supabase.auth.verifyOtp({
          email: cleanEmail,
          token: otp,
          type: "email",
        });
        if (error) throw error;
      } else {
        const cleanPhone = phone.replace(/[^\d+]/g, "");
        const { error } = await supabase.auth.verifyOtp({
          phone: cleanPhone,
          token: otp,
          type: "sms",
        });
        if (error) throw error;
      }
      toast.success("Welcome to Zari!");
      router.navigate({ to: "/" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid code";
      setFormError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const resetToStart = () => {
    setStep("identify");
    setOtp("");
    setFormError("");
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
            Sign in with a secure one-time code
          </p>
        </div>

        {step === "identify" && (
          <>
            <div className="flex p-1 rounded-full bg-blush/60 mb-6 text-sm">
              <button
                type="button"
                onClick={() => setChannel("email")}
                className={`flex-1 py-2 rounded-full inline-flex items-center justify-center gap-2 transition-all ${channel === "email" ? "bg-background shadow-soft text-foreground" : "text-muted-foreground"}`}
              >
                <Mail className="w-3.5 h-3.5" /> Email
              </button>
              <button
                type="button"
                onClick={() => setChannel("phone")}
                className={`flex-1 py-2 rounded-full inline-flex items-center justify-center gap-2 transition-all ${channel === "phone" ? "bg-background shadow-soft text-foreground" : "text-muted-foreground"}`}
              >
                <Smartphone className="w-3.5 h-3.5" /> Phone
              </button>
            </div>

            <form onSubmit={sendCode} className="space-y-4">
              {formError && (
                <div className="flex gap-2 rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>{formError}</p>
                </div>
              )}

              {channel === "email" ? (
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
              ) : (
                <div className="relative">
                  <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+919876543210"
                    className="w-full pl-11 pr-4 py-3.5 rounded-full bg-blush/60 border border-border focus:border-primary focus:bg-background outline-none transition-all"
                    required
                  />
                </div>
              )}

              {channel === "email" && isAdmin && (
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
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-full bg-primary text-primary-foreground font-medium tracking-wide shadow-soft hover:shadow-petal transition-all disabled:opacity-60 inline-flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {channel === "email" && isAdmin ? "Sign in as admin" : "Send verification code"}
              </button>
            </form>
          </>
        )}

        {step === "otp" && (
          <form onSubmit={verifyCode} className="space-y-4">
            {formError && (
              <div className="flex gap-2 rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{formError}</p>
              </div>
            )}
            <p className="text-xs text-center text-muted-foreground">
              Enter the 6-digit code sent to{" "}
              <span className="font-medium text-foreground">
                {channel === "email" ? email : phone}
              </span>
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
              Back — use a different {channel === "email" ? "email" : "phone number"}
            </button>
          </form>
        )}

        <p className="mt-6 text-[11px] text-center text-muted-foreground/80 bg-blush/60 rounded-xl py-2 px-3">
          We'll send you a one-time code — no password needed.
        </p>
      </motion.div>
    </div>
  );
}
