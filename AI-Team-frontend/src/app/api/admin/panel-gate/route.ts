import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/adminAccess";

export const dynamic = "force-dynamic";

// Admin panel gate credentials. They live only in this route handler, which is
// never bundled for the browser; the admin layout posts here to check them.
const PANEL_CREDENTIALS: Record<string, string> = {
  "digitalcoachai@gmail.com": "Dca!2026#wQ5n",
  "luca.papa.digital@gmail.com": "Lcp@2026!hB8s",
  "natali@digital-coach.com": "Ntl!2026#vK9q",
  "giuseppe@digital-coach.com": "Gsp@2026!mR4x",
  "giuseppe.grimaldi.digitalcoach@gmail.com": "Grm#2026@pT7z",
};

function passwordMatches(expected: string, given: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    const expected = PANEL_CREDENTIALS[email];
    const ok = isAdminEmail(email) && expected !== undefined && passwordMatches(expected, password);

    return NextResponse.json({ ok }, { status: ok ? 200 : 401 });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
