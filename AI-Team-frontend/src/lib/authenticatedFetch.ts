import { applyDevAuthHeaders, isDevAuthEnabled } from "./devToken";

type ClerkTokenGetter = () => Promise<string | null>;

let tokenGetter: ClerkTokenGetter | null = null;
let markTokenGetterReady: (() => void) | null = null;

const tokenGetterReady = new Promise<void>((resolve) => {
  markTokenGetterReady = resolve;
});

/**
 * Registers Clerk's getToken function for API calls made outside React hooks.
 * The root ApiAuthBridge keeps this synchronized with the active session.
 */
export function registerApiTokenGetter(getter: ClerkTokenGetter) {
  tokenGetter = getter;
  markTokenGetterReady?.();
  markTokenGetterReady = null;

  return () => {
    if (tokenGetter === getter) {
      tokenGetter = null;
    }
  };
}

function requestUrl(input: RequestInfo | URL) {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function targetsBackendApi(input: RequestInfo | URL) {
  const configuredBase = process.env.NEXT_PUBLIC_API_BASE?.replace(/\/+$/, "");
  if (!configuredBase) return false;

  const url = requestUrl(input);
  return url === configuredBase || url.startsWith(`${configuredBase}/`);
}

async function currentClerkToken() {
  // A development-token session never signs in, so there is no getter to wait for.
  if (isDevAuthEnabled()) {
    return null;
  }

  if (!tokenGetter && typeof window !== "undefined") {
    await Promise.race([
      tokenGetterReady,
      new Promise<void>((resolve) => window.setTimeout(resolve, 5_000)),
    ]);
  }

  return tokenGetter?.() ?? null;
}

/**
 * Drop-in fetch replacement. It authenticates only requests that target
 * NEXT_PUBLIC_API_BASE; third-party and local Next.js API requests pass
 * through unchanged.
 *
 * The development token from .env is used first when one is configured — that
 * is the credential a developer works with instead of signing in. Without it
 * the request carries the Clerk bearer token of the active session.
 */
export async function authenticatedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
) {
  if (!targetsBackendApi(input)) {
    return fetch(input, init);
  }

  const headers = new Headers(input instanceof Request ? input.headers : undefined);
  new Headers(init.headers).forEach((value, key) => headers.set(key, value));

  if (!applyDevAuthHeaders(headers)) {
    const token = await currentClerkToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  return fetch(input, { ...init, headers });
}
