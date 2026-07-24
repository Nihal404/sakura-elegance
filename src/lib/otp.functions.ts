import { createServerFn } from "@tanstack/react-start";
import { createHash, randomInt } from "crypto";

const RESEND_GATEWAY = "https://connector-gateway.lovable.dev/resend";
const FROM = "Zari Boutique <onboarding@resend.dev>";
const OTP_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;

const WHATSAPP_API_BASE = "https://graph.facebook.com/v18.0";
const WHATSAPP_TEMPLATE_NAME = process.env.WHATSAPP_TEMPLATE_NAME || "zari_verification";
const WHATSAPP_TEMPLATE_LANG = process.env.WHATSAPP_TEMPLATE_LANG || "en";

type Channel = "email" | "whatsapp";
type OtpSendResult = { ok: true } | { ok: false; error: string };
type BasicResult = { ok: true } | { ok: false; error: string };
type VerifyResult = { ok: true; token_hash: string; email: string } | { ok: false; error: string };

const hashCode = (email: string, code: string) =>
  createHash("sha256").update(`${email.toLowerCase()}:${code}`).digest("hex");

const normalizePhone = (phone?: string | null) => {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("+") ? digits : `+${digits}`;
};

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

async function sendEmailOtp(email: string, code: string): Promise<OtpSendResult> {
  const lovableApiKey = process.env.LOVABLE_API_KEY;
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!lovableApiKey || !resendApiKey) {
    return {
      ok: false,
      error: "Email sending is not connected yet. Please reconnect Resend or set up a verified sender domain.",
    };
  }

  const res = await fetch(`${RESEND_GATEWAY}/emails`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${lovableApiKey}`,
      "X-Connection-Api-Key": resendApiKey,
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
          "Resend is in test mode, so codes only deliver to the Resend account owner's email. Verify a domain in Resend and update the sender to send codes to other addresses.";
      } else if (parsed?.message) {
        msg = parsed.message;
      }
    } catch {
      // keep default
    }
    return { ok: false, error: msg };
  }
  return { ok: true };
}

async function sendWhatsAppOtp(phone: string, code: string): Promise<OtpSendResult> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneNumberId || !accessToken) {
    return { ok: false, error: "WhatsApp is not configured yet. Falling back to email." };
  }

  const to = normalizePhone(phone);
  if (!to || to.length < 10) {
    return { ok: false, error: "A valid phone number is required for WhatsApp codes." };
  }

  const res = await fetch(`${WHATSAPP_API_BASE}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "template",
      template: {
        name: WHATSAPP_TEMPLATE_NAME,
        language: { code: WHATSAPP_TEMPLATE_LANG },
        components: [
          {
            type: "body",
            parameters: [{ type: "text", text: code }],
          },
        ],
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("WhatsApp send failed", res.status, body);
    let msg = "Could not send the WhatsApp code. Please try again.";
    try {
      const parsed = JSON.parse(body) as { error?: { message?: string } };
      if (parsed?.error?.message) msg = parsed.error.message;
    } catch {
      // keep default
    }
    return { ok: false, error: msg };
  }
  return { ok: true };
}

async function sendOtpTo(
  email: string,
  channel: Channel,
  phone?: string | null,
): Promise<OtpSendResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Rate-limit: max 3 codes per email per 5 min
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { count } = await supabaseAdmin
    .from("email_otps")
    .select("id", { count: "exact", head: true })
    .eq("email", email)
    .gte("created_at", fiveMinAgo);
  if ((count ?? 0) >= 3) {
    return { ok: false, error: "Too many codes requested. Please wait a few minutes." };
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const expires_at = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString();
  const code_hash = hashCode(email, code);

  const { data: otpRow, error: insertErr } = await supabaseAdmin
    .from("email_otps")
    .insert({ email, code_hash, expires_at })
    .select("id")
    .single();
  if (insertErr || !otpRow) {
    return { ok: false, error: "Could not create sign-in code." };
  }

  let sendResult: OtpSendResult;
  if (channel === "whatsapp") {
    sendResult = await sendWhatsAppOtp(phone ?? "", code);
    if (!sendResult.ok) {
      // If WhatsApp fails, try email as a fallback so the user isn't stuck.
      const fallback = await sendEmailOtp(email, code);
      if (fallback.ok) {
        return { ok: true };
      }
    }
  } else {
    sendResult = await sendEmailOtp(email, code);
  }

  if (!sendResult.ok) {
    await supabaseAdmin.from("email_otps").delete().eq("id", otpRow.id);
    return sendResult;
  }

  return { ok: true };
}

/**
 * Sign-up: creates the account (email pre-confirmed) then sends the 2FA code.
 * The user completes sign-in by verifying the code.
 */
export const signUpUser = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { email: string; password: string; name?: string; phone?: string; channel?: Channel }) => {
      const email = data.email?.trim().toLowerCase();
      const password = data.password ?? "";
      const name = data.name?.trim() || undefined;
      const phone = data.phone?.trim() || undefined;
      const channel: Channel = data.channel === "whatsapp" ? "whatsapp" : "email";
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error("Enter a valid email address.");
      }
      if (password.length < 8) {
        throw new Error("Password must be at least 8 characters.");
      }
      if (channel === "whatsapp" && !phone) {
        throw new Error("Phone number is required for WhatsApp verification.");
      }
      return { email, password, name, phone, channel };
    },
  )
  .handler(async ({ data }): Promise<BasicResult> => {
    const { email, password, name, phone, channel } = data;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const existing = list?.users?.find((u) => u.email?.toLowerCase() === email);
    if (existing) {
      return { ok: false, error: "An account with this email already exists. Please sign in instead." };
    }

    // Phone uniqueness check against profiles
    if (phone) {
      const { data: phoneMatch } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("phone", phone)
        .limit(1)
        .maybeSingle();
      if (phoneMatch) {
        return { ok: false, error: "An account with this phone number already exists. Please sign in instead." };
      }
    }

    const metadata: Record<string, unknown> = {};
    if (name) metadata.name = name;
    if (phone) metadata.phone = phone;

    // email_confirm: false — user must verify via our OTP before signing in
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
      user_metadata: Object.keys(metadata).length ? metadata : undefined,
    });
    if (createErr || !created.user) {
      return { ok: false, error: createErr?.message || "Could not create your account." };
    }

    const otpResult = await sendOtpTo(email, channel, phone);
    if (!otpResult.ok) {
      await supabaseAdmin.auth.admin.deleteUser(created.user.id).catch(() => {});
      return otpResult;
    }
    return { ok: true };
  });

/**
 * Verify the signup OTP and mark the user's email as confirmed so they can
 * sign in with their password.
 */
export const verifySignupOtp = createServerFn({ method: "POST" })
  .inputValidator((data: { email: string; code: string }) => {
    const email = data.email?.trim().toLowerCase();
    const code = data.code?.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Enter a valid email address.");
    }
    if (!code || !/^\d{6}$/.test(code)) throw new Error("Enter the 6-digit code.");
    return { email, code };
  })
  .handler(async ({ data }): Promise<BasicResult> => {
    const { email, code } = data;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows } = await supabaseAdmin
      .from("email_otps")
      .select("id, code_hash, expires_at, attempts, used")
      .eq("email", email)
      .eq("used", false)
      .order("created_at", { ascending: false })
      .limit(1);
    const row = rows?.[0];
    if (!row) return { ok: false, error: "No active code. Request a new one." };
    if (new Date(row.expires_at).getTime() < Date.now()) {
      return { ok: false, error: "Code expired. Request a new one." };
    }
    if (row.attempts >= MAX_ATTEMPTS) {
      return { ok: false, error: "Too many attempts. Request a new code." };
    }
    if (hashCode(email, code) !== row.code_hash) {
      await supabaseAdmin.from("email_otps").update({ attempts: row.attempts + 1 }).eq("id", row.id);
      return { ok: false, error: "Invalid code." };
    }
    await supabaseAdmin.from("email_otps").update({ used: true }).eq("id", row.id);

    // Find the user and confirm their email
    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const user = list?.users?.find((u) => u.email?.toLowerCase() === email);
    if (!user) return { ok: false, error: "Account not found. Please sign up again." };

    await supabaseAdmin.auth.admin.updateUserById(user.id, { email_confirm: true });
    return { ok: true };
  });

/**
 * Step 1 of 2FA sign-in: validate the password server-side (no session persisted),
 * then send a one-time code by the chosen channel.
 */
export const startLogin = createServerFn({ method: "POST" })
  .inputValidator((data: { email: string; password: string; channel?: Channel }) => {
    const email = data.email?.trim().toLowerCase();
    const password = data.password ?? "";
    const channel: Channel = data.channel === "whatsapp" ? "whatsapp" : "email";
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Enter a valid email address.");
    }
    if (!password) throw new Error("Enter your password.");
    return { email, password, channel };
  })
  .handler(async ({ data }): Promise<BasicResult> => {
    const { email, password, channel } = data;
    const { createClient } = await import("@supabase/supabase-js");
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return { ok: false, error: "Login is not connected yet. Please try again shortly." };
    }
    const supa = createClient(
      supabaseUrl,
      supabaseKey,
      { auth: { persistSession: false, autoRefreshToken: false, storage: undefined } },
    );
    const { data: signIn, error } = await supa.auth.signInWithPassword({ email, password });
    if (error || !signIn?.user) {
      return { ok: false, error: "Invalid email or password." };
    }
    // Immediately discard the session — we only use password check for step 1.
    await supa.auth.signOut().catch(() => {});

    // For existing users choosing WhatsApp, fetch their saved phone from profile.
    let phone: string | null = null;
    if (channel === "whatsapp") {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("phone")
        .eq("id", signIn.user.id)
        .single();
      phone = profile?.phone ?? null;
    }

    const otpResult = await sendOtpTo(email, channel, phone);
    if (!otpResult.ok) return otpResult;
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
  .handler(async ({ data }): Promise<VerifyResult> => {
    const { email, code } = data;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows, error: qErr } = await supabaseAdmin
      .from("email_otps")
      .select("id, code_hash, expires_at, attempts, used")
      .eq("email", email)
      .eq("used", false)
      .order("created_at", { ascending: false })
      .limit(1);
    if (qErr) return { ok: false, error: "Verification failed." };
    const row = rows?.[0];
    if (!row) return { ok: false, error: "No active code. Request a new one." };
    if (new Date(row.expires_at).getTime() < Date.now()) {
      return { ok: false, error: "Code expired. Request a new one." };
    }
    if (row.attempts >= MAX_ATTEMPTS) {
      return { ok: false, error: "Too many attempts. Request a new code." };
    }

    const expected = hashCode(email, code);
    if (expected !== row.code_hash) {
      await supabaseAdmin
        .from("email_otps")
        .update({ attempts: row.attempts + 1 })
        .eq("id", row.id);
      return { ok: false, error: "Invalid code." };
    }

    await supabaseAdmin.from("email_otps").update({ used: true }).eq("id", row.id);

    const { data: link, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    if (linkErr || !link?.properties?.hashed_token) {
      return { ok: false, error: "Could not create a session. Please try again." };
    }

    return { ok: true, token_hash: link.properties.hashed_token, email };
  });

/**
 * Legacy exports kept so any older call sites keep compiling.
 * Prefer startLogin + verifyLoginOtp.
 */
export const sendOtpEmail = createServerFn({ method: "POST" })
  .inputValidator((data: { email: string; channel?: Channel; phone?: string }) => {
    const email = data.email?.trim().toLowerCase();
    const channel: Channel = data.channel === "whatsapp" ? "whatsapp" : "email";
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Enter a valid email address.");
    }
    return { email, channel, phone: data.phone };
  })
  .handler(async ({ data }): Promise<BasicResult> =>
    sendOtpTo(data.email, data.channel, data.phone),
  );

export const verifyOtpEmail = verifyLoginOtp;

/** Normalize an Indian phone number to E.164 (+91XXXXXXXXXX). */
const normalizeIndianPhone = (raw: string): string | null => {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("91") && digits.length === 12) digits = digits.slice(2);
  if (digits.length !== 10) return null;
  if (!/^[6-9]/.test(digits)) return null;
  return `+91${digits}`;
};

async function findEmailByPhone(phone: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("email, phone")
    .eq("phone", phone)
    .limit(1)
    .maybeSingle();
  return data?.email ?? null;
}

/** Send an OTP for phone-based login. Looks up the email tied to the Indian phone number and delivers by email (SMS provider is not configured). */
export const sendPhoneLoginOtp = createServerFn({ method: "POST" })
  .inputValidator((data: { phone: string }) => {
    const phone = normalizeIndianPhone(data.phone ?? "");
    if (!phone) throw new Error("Enter a valid 10-digit Indian mobile number.");
    return { phone };
  })
  .handler(async ({ data }): Promise<BasicResult> => {
    const email = await findEmailByPhone(data.phone);
    if (!email) {
      return {
        ok: false,
        error: "No account is linked to this phone number. Please sign in with email instead.",
      };
    }
    return sendOtpTo(email, "email", data.phone);
  });

/** Verify the phone-login OTP and return a magic-link token_hash the client exchanges for a session. */
export const verifyPhoneLoginOtp = createServerFn({ method: "POST" })
  .inputValidator((data: { phone: string; code: string }) => {
    const phone = normalizeIndianPhone(data.phone ?? "");
    const code = data.code?.trim();
    if (!phone) throw new Error("Enter a valid 10-digit Indian mobile number.");
    if (!code || !/^\d{6}$/.test(code)) throw new Error("Enter the 6-digit code.");
    return { phone, code };
  })
  .handler(async ({ data }): Promise<VerifyResult> => {
    const email = await findEmailByPhone(data.phone);
    if (!email) return { ok: false, error: "No account linked to this phone number." };
    return verifyLoginOtp({ data: { email, code: data.code } }) as Promise<VerifyResult>;
  });
