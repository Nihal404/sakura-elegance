import { createServerFn } from "@tanstack/react-start";
import { createHash, randomInt } from "crypto";

const OTP_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;

const WHATSAPP_API_BASE = "https://graph.facebook.com/v18.0";
const WHATSAPP_TEMPLATE_NAME = process.env.WHATSAPP_TEMPLATE_NAME || "zari_verification";
const WHATSAPP_TEMPLATE_LANG = process.env.WHATSAPP_TEMPLATE_LANG || "en";

type Channel = "email" | "whatsapp";
type OtpSendResult = { ok: true } | { ok: false; error: string };
type BasicResult = { ok: true; channel?: Channel } | { ok: false; error: string };


const hashCode = (email: string, code: string) =>
  createHash("sha256").update(`${email.toLowerCase()}:${code}`).digest("hex");

const normalizePhone = (phone?: string | null) => {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("+") ? digits : `+${digits}`;
};

// Email OTP delivery is handled by Supabase Auth's built-in mailer
// (client calls supabase.auth.signInWithOtp / verifyOtp). No Resend usage.


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

/** Send a WhatsApp OTP and store its hashed code in email_otps for later server-side verification. */
async function sendWhatsAppOtpWithStore(email: string, phone: string): Promise<OtpSendResult> {
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

  const sendResult = await sendWhatsAppOtp(phone, code);
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
      // If a prior signup was abandoned (never verified), wipe it so the
      // user can try again cleanly — nothing stays in the DB for unverified accounts.
      const isPending =
        (existing.user_metadata as { pending_verification?: boolean } | null)?.pending_verification === true;
      if (isPending) {
        await supabaseAdmin.auth.admin.deleteUser(existing.id).catch(() => {});
        await supabaseAdmin.from("email_otps").delete().eq("email", email);
      } else {
        return { ok: false, error: "An account with this email already exists. Please sign in instead." };
      }
    }

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

    const metadata: Record<string, unknown> = { pending_verification: true };
    if (name) metadata.name = name;
    if (phone) metadata.phone = phone;

    // We flag the account as pending_verification. It is deleted if the OTP
    // is not successfully verified — so nothing lingers for failed signups.
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: metadata,
    });
    if (createErr || !created.user) {
      return { ok: false, error: createErr?.message || "Could not create your account." };
    }

    if (channel === "whatsapp") {
      const otpResult = await sendWhatsAppOtpWithStore(email, phone!);
      if (!otpResult.ok) {
        await supabaseAdmin.auth.admin.deleteUser(created.user.id).catch(() => {});
        return otpResult;
      }
    }
    return { ok: true, channel };
  });

/** Delete the pending (unverified) account tied to an email. Called when the
 *  user backs out of the OTP step before verifying. */
export const cancelPendingSignup = createServerFn({ method: "POST" })
  .inputValidator((data: { email: string }) => {
    const email = data.email?.trim().toLowerCase();
    if (!email) throw new Error("Email required.");
    return { email };
  })
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const user = list?.users?.find((u) => u.email?.toLowerCase() === data.email);
    if (user) {
      const isPending =
        (user.user_metadata as { pending_verification?: boolean } | null)?.pending_verification === true;
      if (isPending) await supabaseAdmin.auth.admin.deleteUser(user.id).catch(() => {});
    }
    await supabaseAdmin.from("email_otps").delete().eq("email", data.email);
    return { ok: true };
  });

/** Clear the pending_verification flag once the email OTP is verified client-side. */
export const finalizeEmailSignup = createServerFn({ method: "POST" })
  .inputValidator((data: { email: string }) => {
    const email = data.email?.trim().toLowerCase();
    if (!email) throw new Error("Email required.");
    return { email };
  })
  .handler(async ({ data }): Promise<BasicResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const user = list?.users?.find((u) => u.email?.toLowerCase() === data.email);
    if (!user) return { ok: false, error: "Account not found." };
    const currentMeta = (user.user_metadata as Record<string, unknown> | null) ?? {};
    const { pending_verification: _drop, ...rest } = currentMeta;
    void _drop;
    await supabaseAdmin.auth.admin.updateUserById(user.id, { user_metadata: rest });
    return { ok: true };
  });

/**
 * Verify the WhatsApp signup OTP. On failure (expired / too many attempts)
 * the pending account is deleted so no unverified data stays in the database.
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

    const deletePendingUser = async () => {
      const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const user = list?.users?.find((u) => u.email?.toLowerCase() === email);
      if (user) {
        const isPending =
          (user.user_metadata as { pending_verification?: boolean } | null)?.pending_verification === true;
        if (isPending) await supabaseAdmin.auth.admin.deleteUser(user.id).catch(() => {});
      }
    };

    const { data: rows } = await supabaseAdmin
      .from("email_otps")
      .select("id, code_hash, expires_at, attempts, used")
      .eq("email", email)
      .eq("used", false)
      .order("created_at", { ascending: false })
      .limit(1);
    const row = rows?.[0];
    if (!row) {
      await deletePendingUser();
      return { ok: false, error: "No active code. Please sign up again." };
    }
    if (new Date(row.expires_at).getTime() < Date.now()) {
      await deletePendingUser();
      return { ok: false, error: "Code expired. Please sign up again." };
    }
    if (row.attempts >= MAX_ATTEMPTS) {
      await deletePendingUser();
      return { ok: false, error: "Too many attempts. Please sign up again." };
    }
    if (hashCode(email, code) !== row.code_hash) {
      const nextAttempts = row.attempts + 1;
      await supabaseAdmin.from("email_otps").update({ attempts: nextAttempts }).eq("id", row.id);
      if (nextAttempts >= MAX_ATTEMPTS) {
        await deletePendingUser();
        return { ok: false, error: "Too many attempts. Please sign up again." };
      }
      return { ok: false, error: "Invalid code." };
    }
    await supabaseAdmin.from("email_otps").update({ used: true }).eq("id", row.id);

    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const user = list?.users?.find((u) => u.email?.toLowerCase() === email);
    if (!user) return { ok: false, error: "Account not found. Please sign up again." };

    const currentMeta = (user.user_metadata as Record<string, unknown> | null) ?? {};
    const { pending_verification: _drop, ...rest } = currentMeta;
    void _drop;
    await supabaseAdmin.auth.admin.updateUserById(user.id, {
      email_confirm: true,
      user_metadata: rest,
    });
    return { ok: true };
  });

