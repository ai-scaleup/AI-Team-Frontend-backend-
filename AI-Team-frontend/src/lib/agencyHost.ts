import { API_BASE } from "./apiBase";

// ===================================================
// Agency mode (lib/agencyHost.ts)
// Agency customers use the app without Clerk: they sign in with a password
// kept by the backend, and the session lives in the AGENCY_SESSION_COOKIE
// cookie. On the AI Team address an agency lives under its name:
//   /<slug>                 sign-in   (served by /agency-login/<agencyId>)
//   /<slug>/setup?code=…    setup link
//   /<slug>/dashboard/…     the app   (served by /dashboard/…)
// A request is in agency mode when:
//   - it is on the AI Team address and carries an agency sign-in
//     (AGENCY_SESSION_COOKIE + AGENCY_REF_COOKIE, set when signing in), or
//   - it is on an agency's own address (app.youragency.com), when the backend
//     has one on an agency; there the app runs at "/" with no prefix.
// Everything else behaves exactly as before, with Clerk. Safe in middleware,
// server and client.
// ===================================================

export const AGENCY_SESSION_COOKIE = "agency_session";
/** The agency a customer signed in to on the AI Team address. */
export const AGENCY_REF_COOKIE = "agency_ref";

export type AgencyBranding = {
  agencyId: string;
  /** The agency's name as in its address: /<slug>/dashboard. */
  slug: string;
  productName: string;
  logoDataUrl: string | null;
  primaryColor: string;
  suspended: boolean;
  /** Where this agency's customers sign in: "/<slug>", or "/" on its own address. */
  loginPath: string;
};

/** The sign-in page for an agency on the AI Team address. */
export const agencyLoginPath = (slug: string) => `/${slug}`;

/** The prefix in front of /dashboard for an agency: "" on its own address. */
export const agencyPrefix = (branding: Pick<AgencyBranding, "loginPath">) =>
  branding.loginPath === "/" ? "" : branding.loginPath;

/** "/<slug>/dashboard/alex-ai" → "/dashboard/alex-ai"; other paths unchanged. */
export function withoutAgencyPrefix(pathname: string): string {
  return pathname.replace(/^\/[^/]+(?=\/dashboard(\/|$))/, "");
}

/** The platform's own addresses: never looked up. */
const PLATFORM_HOSTS = new Set(
  (process.env.NEXT_PUBLIC_PLATFORM_HOSTS || "ai-team.biz,www.ai-team.biz,localhost,127.0.0.1")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean),
);
const PLATFORM_SUFFIXES = [".vercel.app", ".ngrok-free.app", ".ngrok.app", ".ngrok.io", ".onrender.com"];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** "App.Agency.com:3002" → "app.agency.com" */
export function normalizeHost(host: string | null | undefined): string {
  return (host ?? "").trim().toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
}

function isPlatformHost(hostname: string) {
  return !hostname || PLATFORM_HOSTS.has(hostname) || PLATFORM_SUFFIXES.some((s) => hostname.endsWith(s));
}

const CACHE_MS = 60_000;
const cache = new Map<string, { at: number; value: AgencyBranding | null }>();

/**
 * Branding from the backend, cached for a minute per server instance. A
 * backend that cannot be reached counts as "not an agency" so platform pages
 * keep working.
 */
async function fetchBranding(query: string, loginPath: (b: AgencyBranding) => string): Promise<AgencyBranding | null> {
  const hit = cache.get(query);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;

  let value: AgencyBranding | null = null;
  try {
    const res = await fetch(`${API_BASE}/agency-auth/branding?${query}`, {
      cache: "no-store",
      headers: { "ngrok-skip-browser-warning": "true" },
    });
    if (res.ok) {
      const branding = (await res.json()) as AgencyBranding;
      value = { ...branding, loginPath: loginPath(branding) };
    }
  } catch {
    value = null;
  }
  cache.set(query, { at: Date.now(), value });
  if (cache.size > 500) cache.delete(cache.keys().next().value as string);
  return value;
}

/** The agency branding for an address, or null when it is not an agency's own address. */
export async function agencyBrandingForHost(host: string | null | undefined): Promise<AgencyBranding | null> {
  const hostname = normalizeHost(host);
  if (isPlatformHost(hostname) || !API_BASE) return null;
  return fetchBranding(`host=${encodeURIComponent(hostname)}`, () => "/");
}

/** The branding of a live agency by id, or null. */
export async function agencyBrandingForId(agencyId: string | null | undefined): Promise<AgencyBranding | null> {
  if (!agencyId || !UUID_RE.test(agencyId) || !API_BASE) return null;
  return fetchBranding(`agency=${encodeURIComponent(agencyId)}`, (b) => agencyLoginPath(b.slug));
}

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** The branding of the live agency whose name gives this address segment, or null. */
export async function agencyBrandingForSlug(slug: string | null | undefined): Promise<AgencyBranding | null> {
  if (!slug || slug.length > 60 || !SLUG_RE.test(slug) || !API_BASE) return null;
  return fetchBranding(`slug=${encodeURIComponent(slug)}`, (b) => agencyLoginPath(b.slug));
}

type CookieReader = { get(name: string): { value: string } | undefined };

/**
 * The agency this request runs as, or null for the platform (Clerk). The
 * session cookie itself is checked by the backend on every call; here it only
 * decides the mode.
 */
export async function agencyForRequest(host: string | null | undefined, cookies: CookieReader): Promise<AgencyBranding | null> {
  const own = await agencyBrandingForHost(host);
  if (own) return own;
  const ref = cookies.get(AGENCY_REF_COOKIE)?.value;
  if (!ref || !cookies.get(AGENCY_SESSION_COOKIE)?.value) return null;
  return agencyBrandingForId(ref);
}
