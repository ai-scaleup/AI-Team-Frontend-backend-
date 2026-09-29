/**
 * Base URL of the ai_team_server backend, read once from NEXT_PUBLIC_API_BASE.
 *
 * Surrounding whitespace and trailing slashes are removed so callers can always
 * write `${API_BASE}/path` without producing `//path`, which the backend 404s.
 * Next.js inlines NEXT_PUBLIC_* values at build time, so a changed value only
 * takes effect after a rebuild/redeploy.
 *
 * Without a configured value, development falls back to the local backend on
 * port 3000; a production build has no sensible default and stays empty.
 */
const configuredApiBase = (process.env.NEXT_PUBLIC_API_BASE ?? "").trim().replace(/\/+$/, "");

export const API_BASE =
  configuredApiBase || (process.env.NODE_ENV === "development" ? "http://localhost:3000" : "");

if (!API_BASE && typeof window !== "undefined") {
  console.error("NEXT_PUBLIC_API_BASE is not set; backend requests will fail.");
}
