import { auth, currentUser } from "@clerk/nextjs/server";
import { cookies, headers } from "next/headers";
import { API_BASE } from "./apiBase";
import { AGENCY_SESSION_COOKIE, agencyForRequest } from "./agencyHost";
import type { AgencyBranding } from "./agencyHost";

// ===================================================
// Who is calling a route handler (lib/serverSession.ts)
// In agency mode (lib/agencyHost.ts) the caller is an agency customer with our
// own session cookie; otherwise it is a Clerk user, exactly as before. Route
// handlers ask here instead of calling Clerk's auth() directly, because in
// agency mode Clerk is not running at all.
// ===================================================

export type RequestSession = {
  kind: "clerk" | "agency";
  /** Clerk user id, or the agency customer's User.oauthId. Same role either way. */
  userId: string;
  /** Known up front for agency customers; use requestEmail() otherwise. */
  email: string | null;
  /** Bearer token for backend calls made on the user's behalf. */
  getToken: () => Promise<string | null>;
};

export type AgencyMe = {
  /** email: the customer's own User email, used for calls; loginEmail: what they sign in with. */
  user: { id: string; email: string; loginEmail?: string; name: string };
  agency: { id: string; productName: string; logoDataUrl: string | null; primaryColor: string };
};

/** The customer behind an agency session token, or null when it is not valid. */
export async function fetchAgencyMe(token: string): Promise<AgencyMe | null> {
  if (!API_BASE || !token) return null;
  try {
    const res = await fetch(`${API_BASE}/agency-auth/me`, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}`, "ngrok-skip-browser-warning": "true" },
    });
    return res.ok ? ((await res.json()) as AgencyMe) : null;
  } catch {
    return null;
  }
}

/** The agency this request runs as (agency mode), or null on the platform. */
export async function requestAgency(): Promise<AgencyBranding | null> {
  return agencyForRequest((await headers()).get("host"), await cookies());
}

export async function getRequestSession(): Promise<RequestSession | null> {
  if (await requestAgency()) {
    const token = (await cookies()).get(AGENCY_SESSION_COOKIE)?.value ?? "";
    const me = await fetchAgencyMe(token);
    if (!me) return null;
    return { kind: "agency", userId: me.user.id, email: me.user.email, getToken: async () => token };
  }

  const session = await auth();
  if (!session.userId) return null;
  return { kind: "clerk", userId: session.userId, email: null, getToken: () => session.getToken() };
}

/** The signed-in user's own email, or undefined. */
export async function requestEmail(session?: RequestSession | null): Promise<string | undefined> {
  const s = session === undefined ? await getRequestSession() : session;
  if (!s) return undefined;
  if (s.email) return s.email;
  try {
    const user = await currentUser();
    return user?.primaryEmailAddress?.emailAddress ?? undefined;
  } catch {
    return undefined;
  }
}
