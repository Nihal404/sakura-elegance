/**
 * Turns auth/network failures into a message that names the real cause instead of
 * bubbling up a bare "fetch failed" / "Failed to fetch".
 *
 * A browser fetch to Supabase Auth rejects with a TypeError (no status, no body) when
 * the configured project URL cannot be reached at all: wrong/stale VITE_SUPABASE_URL in
 * the deployment, a deleted or paused project (DNS does not resolve), offline client, or
 * a blocking network/extension. Those all previously surfaced as just "fetch failed".
 */

export const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? "";

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url || "(not configured)";
  }
}

export function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError) return true;
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  return (
    msg.includes("fetch failed") ||
    msg.includes("failed to fetch") ||
    msg.includes("networkerror") ||
    msg.includes("network request failed") ||
    msg.includes("load failed") ||
    msg.includes("err_name_not_resolved") ||
    msg.includes("enotfound") ||
    msg.includes("econnrefused")
  );
}

/** Human-readable description that keeps the underlying error text visible. */
export function describeAuthError(err: unknown): string {
  const raw =
    err instanceof Error ? err.message : typeof err === "string" ? err : JSON.stringify(err);

  if (!supabaseUrl) {
    return "Authentication is not configured for this deployment: VITE_SUPABASE_URL is missing from the build environment.";
  }

  if (isNetworkError(err)) {
    return `Could not reach the authentication server at ${hostOf(supabaseUrl)} (${raw}). This deployment's VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY may point at the wrong or a deleted project, or the network blocked the request.`;
  }

  return raw || "Sign in failed.";
}

/**
 * Confirms the configured auth host is actually reachable. Returns null when fine,
 * otherwise a precise message. Used to explain failures rather than to gate sign-in.
 */
export async function checkAuthReachable(): Promise<string | null> {
  if (!supabaseUrl) {
    return "VITE_SUPABASE_URL is missing from this deployment's build environment.";
  }
  try {
    await fetch(`${supabaseUrl}/auth/v1/health`, { method: "GET", mode: "cors" });
    return null;
  } catch (err) {
    return describeAuthError(err);
  }
}
