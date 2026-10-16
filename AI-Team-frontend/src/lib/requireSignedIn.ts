import { getRequestSession } from "./serverSession";
import { NextResponse } from "next/server";
import { isDevAuthEnabled } from "./devToken";

/**
 * Guards route handlers that spend a server-held API key on behalf of the
 * dashboard. Returns a 401 response unless the caller is signed in (Clerk, or
 * the agency login on an agency's address), or a development-token session is
 * configured (mirroring middleware.ts).
 */
export async function requireSignedIn(): Promise<NextResponse | null> {
  if (isDevAuthEnabled()) return null;

  return (await getRequestSession()) ? null : NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
