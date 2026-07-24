import { createServerFn } from "@tanstack/react-start";
import { createHash, randomInt } from "crypto";

const RESEND_GATEWAY = "https://connector-gateway.lovable.dev/resend";
const FROM = "Zari Boutique <onboarding@resend.dev>";
const OTP_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;

const hashCode = (email: string, code: string) =>
  createHash("sha256").update(`${email.toLowerCase()}:${code}`).digest("hex");

const emailHtml = (code: string) => `
  <div style="font-family: 'Playfair Display', Georgia, serif; max-width: 480px; margin: 0 auto; padding: 32px; background: linear-gradient(135deg, #fff5f7 0%, #ffe4ec 100%); border-radius: 20px; color: #4a2c3a;">
    <h1 style="font-size: 28px; margin: 0 0 8px; color: #b8577a;">Zari Boutique</h1>
    <p style="font-size: 14px; color: #7a5566; margin: 0 0 24px;">Your 2-step verification code</p>
    <div style="background: white; border-radius: 14px; padding: 24px; text-align: center; box-shadow: 0 4px 20px rgba(232, 156, 178, 0.2);">
      <div style="font-family: 'Courier New', monospace; font-size: 36px; letter-spacing: 12px; color: #b8577a; font-weight: 700;">${code}</div>
    </div>
    <p style="font-size: 13px; color: #7a5566; margin-top: 20px; line-height: 1.6;">
      Enter this code to finish signing in. It expires in ${OTP_TTL_MINUTES} minutes. If you didn't try to sign in, you can safely ignore this email.
    </p>
    <p style="font-size: 11px; color: #a68899; margin-top: 24px; text-align: center;">
      🌸 With love, Zari Boutique
    </p>
  </div>
`;

async function sendOtpTo(email: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Rate-limit: max 3 codes per email per 5 min
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { count } = await supabaseAdmin
    .from("email_otps")
    .select("id", { count: "exact", head: true })
    .eq("email", email)
    .gte("created_at", fiveMinAgo);
  if ((count ?? 0) >= 3) {
    throw new Error("Too many codes requested. Please wait a few minutes.");
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const expires_at = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString();
  const code_hash = hashCode(email, code);

  const { error: insertErr } = await supabaseAdmin
    .from("email_otps")
    .insert({ email, code_hash, expires_at });
  if (insertErr) throw new Error("Could not create sign-in code.");

  const res = await fetch(`${RESEND_GATEWAY}/emails`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": process.env.RESEND_API_KEY!,
    },
    body: JSON.stringify({
      from: FROM,
      to: [email],
      subject: `Your Zari verification code: ${code}`,
      html: emailHtml(code),
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error("Resend send failed", res.status, body);
    let msg = "Could not send the verification email. Please try again.";
    try {
      const parsed = JSON.parse(body) as { message?: string; name?: string };
      if (parsed?.name === "validation_error" && parsed.message?.includes("testing emails")) {
        msg =
          "Email sending is restricted to the Resend account owner's address until a domain is verified. Verify a domain at resend.com/domains and update the sender.";
      } else if (parsed?.message) {
        msg = parsed.message;
      }
    } catch {
      // keep default
    }
    throw new Error(msg);
  }
}

/**
 * Sign-up: creates the account (email pre-confirmed) then sends the 2FA code.
 * The user completes sign-in by verifying the code.
 */
export const signUpUser = createServerFn({ method: "POST" })
  .inputValidator((data: { email: string; password: string; name?: string }) => {
    const email = data.email?.trim().toLowerCase();
    const password = data.password ?? "";
    const name = data.name?.trim() || undefined;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Enter a valid email address.");
    }
    if (password.length < 8) {
      throw new Error("Password must be at least 8 characters.");
    }
    return { email, password, name };
  })
  .handler(async ({ data }) => {
    const { email, password, name } = data;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const existing = list?.users?.find((u) => u.email?.toLowerCase() === email);
    if (existing) {
      throw new Error("An account with this email already exists. Please sign in instead.");
    }

    const { error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: name ? { name } : undefined,
    });
    if (createErr) throw new Error(createErr.message || "Could not create your account.");

    await sendOtpTo(email);
    return { ok: true };
  });

/**
 * Step 1 of 2FA sign-in: validate the password server-side (no session persisted),
 * then send a one-time code by email.
 */
export const startLogin = createServerFn({ method: "POST" })
  .inputValidator((data: { email: string; password: string }) => {
    const email = data.email?.trim().toLowerCase();
    const password = data.password ?? "";
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Enter a valid email address.");
    }
    if (!password) throw new Error("Enter your password.");
    return { email, password };
  })
  .handler(async ({ data }) => {
    const { email, password } = data;
    const { createClient } = await import("@supabase/supabase-js");
    const supa = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false, storage: undefined } },
    );
    const { data: signIn, error } = await supa.auth.signInWithPassword({ email, password });
    if (error || !signIn?.user) {
      throw new Error("Invalid email or password.");
    }
    // Immediately discard the session — we only use password check for step 1.
    await supa.auth.signOut().catch(() => {});

    await sendOtpTo(email);
    return { ok: true };
  });

/**
 * Step 2 of 2FA: verify the 6-digit code and mint a magiclink token_hash
 * that the client exchanges for a real session via supabase.auth.verifyOtp.
 */
export const verifyLoginOtp = createServerFn({ method: "POST" })
  .inputValidator((data: { email: string; code: string }) => {
    const email = data.email?.trim().toLowerCase();
    const code = data.code?.trim();
    if (!email || !code || !/^\d{6}$/.test(code)) {
      throw new Error("Enter the 6-digit code.");
    }
    return { email, code };
  })
  .handler(async ({ data }) => {
    const { email, code } = data;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows, error: qErr } = await supabaseAdmin
      .from("email_otps")
      .select("id, code_hash, expires_at, attempts, used")
      .eq("email", email)
      .eq("used", false)
      .order("created_at", { ascending: false })
      .limit(1);
    if (qErr) throw new Error("Verification failed.");
    const row = rows?.[0];
    if (!row) throw new Error("No active code. Request a new one.");
    if (new Date(row.expires_at).getTime() < Date.now()) {
      throw new Error("Code expired. Request a new one.");
    }
    if (row.attempts >= MAX_ATTEMPTS) {
      throw new Error("Too many attempts. Request a new code.");
    }

    const expected = hashCode(email, code);
    if (expected !== row.code_hash) {
      await supabaseAdmin
        .from("email_otps")
        .update({ attempts: row.attempts + 1 })
        .eq("id", row.id);
      throw new Error("Invalid code.");
    }

    await supabaseAdmin.from("email_otps").update({ used: true }).eq("id", row.id);

    const { data: link, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    if (linkErr || !link?.properties?.hashed_token) {
      throw new Error("Could not create a session. Please try again.");
    }

    return { token_hash: link.properties.hashed_token, email };
  });

/**
 * Legacy exports kept so any older call sites keep compiling.
 * Prefer startLogin + verifyLoginOtp.
 */
export const sendOtpEmail = createServerFn({ method: "POST" })
  .inputValidator((data: { email: string }) => {
    const email = data.email?.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Enter a valid email address.");
    }
    return { email };
  })
  .handler(async ({ data }) => {
    await sendOtpTo(data.email);
    return { ok: true };
  });

export const verifyOtpEmail = verifyLoginOtp;
