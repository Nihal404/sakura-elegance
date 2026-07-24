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
    <p style="font-size: 14px; color: #7a5566; margin: 0 0 24px;">Your sign-in code</p>
    <div style="background: white; border-radius: 14px; padding: 24px; text-align: center; box-shadow: 0 4px 20px rgba(232, 156, 178, 0.2);">
      <div style="font-family: 'Courier New', monospace; font-size: 36px; letter-spacing: 12px; color: #b8577a; font-weight: 700;">${code}</div>
    </div>
    <p style="font-size: 13px; color: #7a5566; margin-top: 20px; line-height: 1.6;">
      This code expires in ${OTP_TTL_MINUTES} minutes. If you didn't request it, you can safely ignore this email.
    </p>
    <p style="font-size: 11px; color: #a68899; margin-top: 24px; text-align: center;">
      🌸 With love, Zari Boutique
    </p>
  </div>
`;

export const sendOtpEmail = createServerFn({ method: "POST" })
  .inputValidator((data: { email: string }) => {
    const email = data.email?.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Enter a valid email address.");
    }
    return { email };
  })
  .handler(async ({ data }) => {
    const { email } = data;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Rate-limit: no more than 3 OTPs per email per 5 min
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
        subject: `Your Zari sign-in code: ${code}`,
        html: emailHtml(code),
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error("Resend send failed", res.status, body);
      throw new Error("Could not send the sign-in email. Please try again.");
    }
    return { ok: true };
  });

export const verifyOtpEmail = createServerFn({ method: "POST" })
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

    // Find latest unused, non-expired OTP for this email
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

    // Mark used
    await supabaseAdmin.from("email_otps").update({ used: true }).eq("id", row.id);

    // Ensure user exists (create if missing, with email confirmed)
    const { data: existing } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    const found = existing?.users?.find((u) => u.email?.toLowerCase() === email);
    if (!found) {
      const { error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: true,
      });
      if (createErr) throw new Error("Could not create your account.");
    }

    // Generate a magiclink and return the hashed_token so the client can
    // establish a session via supabase.auth.verifyOtp({ type: 'email', token_hash }).
    const { data: link, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    if (linkErr || !link?.properties?.hashed_token) {
      throw new Error("Could not create a session. Please try again.");
    }

    return { token_hash: link.properties.hashed_token, email };
  });
