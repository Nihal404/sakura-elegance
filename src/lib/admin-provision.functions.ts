import { createServerFn } from "@tanstack/react-start";

const ADMIN_EMAIL = "admin@zariboutique.com";
const ADMIN_PASSWORD = "Zaribotique#2026";

/**
 * Idempotently ensures the admin account exists with the canonical strong password.
 * Safe to call before every admin sign-in attempt — if the user already exists,
 * we simply reset the password to the canonical one so the admin is never locked out.
 */
export const ensureAdminAccount = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Look up existing admin user via listUsers (paginated search)
  const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (listErr) throw new Error(listErr.message);

  const existing = list.users.find((u) => u.email?.toLowerCase() === ADMIN_EMAIL);

  if (!existing) {
    const { error } = await supabaseAdmin.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
    });
    if (error && !/already/i.test(error.message)) throw new Error(error.message);
  } else {
    // Ensure email confirmed + password matches canonical strong password
    const { error } = await supabaseAdmin.auth.admin.updateUserById(existing.id, {
      password: ADMIN_PASSWORD,
      email_confirm: true,
    });
    if (error) throw new Error(error.message);
  }

  return { ok: true };
});
