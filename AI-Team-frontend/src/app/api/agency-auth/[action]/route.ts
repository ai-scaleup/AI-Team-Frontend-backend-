import { NextRequest, NextResponse } from "next/server";
import { API_BASE } from "@/lib/apiBase";
import {
  AGENCY_REF_COOKIE, AGENCY_SESSION_COOKIE, agencyBrandingForHost, agencyBrandingForId, agencyForRequest,
} from "@/lib/agencyHost";
import { fetchAgencyMe } from "@/lib/serverSession";

// ===================================================
// Agency customer sign-in (no Clerk).
//   POST /api/agency-auth/login         { agencyId, email, password }
//   POST /api/agency-auth/sign-up       { agencyId, email, password }  (email the agency added)
//   POST /api/agency-auth/set-password  { agencyId, code, password }   (from a setup link)
//   POST /api/agency-auth/logout
//   GET  /api/agency-auth/session       → { token, user, agency }
// On the AI Team address the agency comes from `agencyId` (the sign-in page
// is /agency-login/<agencyId>) and is remembered in AGENCY_REF_COOKIE; on an
// agency's own address the address picks it. The session token lives in an
// httpOnly cookie; the page reads it through /session to call the backend,
// like Clerk's getToken.
// ===================================================

type SessionResponse = { token: string; expiresAt: string };

function cookieOptions(request: NextRequest, expires?: Date) {
  return {
    httpOnly: true,
    secure: request.nextUrl.protocol === "https:",
    sameSite: "lax" as const,
    path: "/",
    ...(expires ? { expires } : { maxAge: 0 }),
  };
}

function clearCookies(res: NextResponse, request: NextRequest) {
  res.cookies.set(AGENCY_SESSION_COOKIE, "", cookieOptions(request));
  res.cookies.set(AGENCY_REF_COOKIE, "", cookieOptions(request));
}

async function backend(path: string, init: { method: string; body?: unknown; token?: string; request: NextRequest }) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "true",
  };
  if (init.token) headers.Authorization = `Bearer ${init.token}`;
  const ip = init.request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (ip) headers["x-agency-client-ip"] = ip;
  const ua = init.request.headers.get("user-agent");
  if (ua) headers["user-agent"] = ua;
  return fetch(`${API_BASE}${path}`, {
    method: init.method,
    headers,
    cache: "no-store",
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

async function relayError(res: Response) {
  let message = "Something went wrong. Try again.";
  try {
    const payload = await res.json();
    if (typeof payload?.message === "string") message = payload.message;
  } catch {
    // keep the generic message
  }
  return NextResponse.json({ error: message }, { status: res.status });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;

  if (action === "logout") {
    const token = request.cookies.get(AGENCY_SESSION_COOKIE)?.value;
    if (token) await backend("/agency-auth/logout", { method: "POST", token, request }).catch(() => null);
    const res = NextResponse.json({ ok: true });
    clearCookies(res, request);
    return res;
  }

  if (action !== "login" && action !== "sign-up" && action !== "set-password") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // An agency's own address picks the agency; elsewhere the page says which.
  const host = request.headers.get("host") ?? "";
  const ownAddress = Boolean(await agencyBrandingForHost(host));
  const agencyId = typeof body?.agencyId === "string" ? body.agencyId : "";
  if (!ownAddress && !(await agencyBrandingForId(agencyId))) {
    return NextResponse.json({ error: "This sign-in page does not belong to an agency" }, { status: 404 });
  }
  const ref = ownAddress ? { host } : { agencyId };
  const payload =
    action === "set-password"
      ? { ...ref, code: body?.code, password: body?.password }
      : { ...ref, email: body?.email, password: body?.password };

  const upstream = await backend(`/agency-auth/${action}`, { method: "POST", body: payload, request });
  if (!upstream.ok) return relayError(upstream);
  const session = (await upstream.json()) as SessionResponse;
  const expires = new Date(session.expiresAt);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AGENCY_SESSION_COOKIE, session.token, cookieOptions(request, expires));
  if (ownAddress) res.cookies.set(AGENCY_REF_COOKIE, "", cookieOptions(request));
  else res.cookies.set(AGENCY_REF_COOKIE, agencyId, cookieOptions(request, expires));
  return res;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  if (action !== "session") return NextResponse.json({ error: "Not found" }, { status: 404 });
  const token = request.cookies.get(AGENCY_SESSION_COOKIE)?.value ?? "";
  const agency = await agencyForRequest(request.headers.get("host"), request.cookies);
  const me = agency && token ? await fetchAgencyMe(token) : null;
  // Signed in to a different agency than this page is for counts as signed out.
  if (!me || me.agency.id !== agency?.agencyId) {
    const res = NextResponse.json({ error: "Not signed in" }, { status: 401 });
    if (token) clearCookies(res, request);
    return res;
  }
  return NextResponse.json(
    { token, ...me },
    { headers: { "Cache-Control": "no-store" } },
  );
}
