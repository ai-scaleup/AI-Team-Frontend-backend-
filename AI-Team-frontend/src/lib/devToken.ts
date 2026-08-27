// ===================================================
// Development token support (lib/devToken.ts)
// Mirrors the backend's auth/dev-token.ts. When a development token is
// configured the frontend authenticates every backend call with it instead of
// a Clerk JWT, and the dashboard stops asking for a login — that token is what
// lets a developer work without signing in.
// Configure it in the frontend .env:
//   NEXT_PUBLIC_DEV_API_TOKEN=<one of the backend's DEV_API_TOKEN values>
//   NEXT_PUBLIC_DEV_USER_EMAIL=<email the dev session should act as>
// Leave both empty and everything falls back to the Clerk bearer token.
// ===================================================

export const DEV_TOKEN_HEADER = "x-dev-token";
export const USER_EMAIL_HEADER = "x-user-email";

/**
 * Read literally so Next.js can inline the public values into the browser
 * bundle. The non-public names are the server-side fallback (middleware and
 * route handlers), where they resolve to undefined in the browser.
 */
const rawDevToken =
  process.env.NEXT_PUBLIC_DEV_API_TOKEN || process.env.DEV_API_TOKEN || "";
const rawDevUserEmail =
  process.env.NEXT_PUBLIC_DEV_USER_EMAIL || process.env.DEV_USER_EMAIL || "";

/** The backend accepts a comma-separated list; the frontend sends the first. */
const devApiToken = rawDevToken.split(",")[0]?.trim() ?? "";
const devUserEmail = rawDevUserEmail.trim();

export function getDevApiToken(): string | null {
  return devApiToken || null;
}

/** True when requests should carry the development token instead of Clerk. */
export function isDevAuthEnabled(): boolean {
  return devApiToken.length > 0;
}

/** The email a development-token session acts as, or "" when unset. */
export function getDevUserEmail(): string {
  return devUserEmail;
}

/**
 * Falls back to the development email when Clerk has no signed-in user, so
 * email-gated screens keep working in a login-free developer session.
 */
export function resolveUserEmail(clerkEmail?: string | null): string {
  return clerkEmail?.trim() || devUserEmail;
}

/**
 * Adds the development credentials to `headers`. Returns false — leaving the
 * headers untouched — when no development token is configured, which is the
 * signal to authenticate with Clerk instead.
 */
export function applyDevAuthHeaders(headers: Headers): boolean {
  if (!devApiToken) return false;

  headers.set(DEV_TOKEN_HEADER, devApiToken);
  if (devUserEmail && !headers.has(USER_EMAIL_HEADER)) {
    headers.set(USER_EMAIL_HEADER, devUserEmail);
  }

  return true;
}
