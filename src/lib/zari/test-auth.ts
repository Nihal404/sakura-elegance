// TEMPORARY TESTING AUTH — remove when production email (Resend/SMTP + domain) is set up.
//
// How to disable later:
//   1. Set TEST_AUTH_ENABLED to false (the "Continue as Test User" button disappears), or
//   2. Delete this file plus its two usages: `signInAsTestUser` in src/lib/store.tsx and the
//      test-user button block in src/routes/login.tsx.
//   3. Turn off Anonymous sign-ins in the Supabase Auth settings.
//
// This uses REAL Supabase Anonymous Auth: the browser gets a genuine Supabase session and
// RLS still applies to it. Anonymous users are always customers — never admins.
import { supabase } from "./supabase";
import { describeError } from "./supabase";

/** Master switch for the temporary test-user flow. */
export const TEST_AUTH_ENABLED = true;

/**
 * Signs in with a real anonymous Supabase session. No email is sent, so the
 * confirmation-email rate limit can never be hit by this path.
 */
export async function signInAsTestUser(): Promise<void> {
  const { error } = await supabase.auth.signInAnonymously();
  if (!error) return;

  const code = (error as { code?: string }).code ?? "";
  const status = (error as { status?: number }).status ?? 0;
  const lower = error.message.toLowerCase();

  if (code === "anonymous_provider_disabled" || lower.includes("anonymous sign-ins are disabled")) {
    throw new Error(
      "Test sign-in is turned off on the backend. Enable \u201cAnonymous sign-ins\u201d in your Supabase Auth settings, then try again.",
    );
  }
  if (status === 429 || code === "over_email_send_rate_limit" || lower.includes("rate limit")) {
    throw new Error("Too many sign-in attempts just now. Please wait a minute and try again.");
  }
  throw new Error(describeError(error, "Could not start a test session."));
}
