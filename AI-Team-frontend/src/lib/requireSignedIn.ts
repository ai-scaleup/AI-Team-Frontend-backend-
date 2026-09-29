import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isDevAuthEnabled } from "./devToken";

/**
 * Guards route handlers that spend a server-held API key on behalf of the
 * dashboard. Returns a 401 response unless the caller has a Clerk session, or
 * a development-token session is configured (mirroring middleware.ts).
 */
export async function requireSignedIn(): Promise<NextResponse | null> {
  if (isDevAuthEnabled()) return null;

  const { userId } = await auth();
  return userId ? null : NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
