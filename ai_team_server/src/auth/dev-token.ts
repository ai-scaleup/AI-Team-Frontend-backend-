// ===================================================
// Development token support (auth/dev-token.ts)
// Lets a caller authenticate with a static token (DEV_API_TOKEN, with a
// built-in fallback for hosts that define none) instead of a Clerk JWT. Either
// credential is accepted, at least one of them is required, and the token is
// the one checked first.
// ===================================================
import { Request } from 'express';

export const DEV_TOKEN_HEADER = 'x-dev-token';

/**
 * The token that applies when the host defines no DEV_API_TOKEN of its own — a
 * deployment (Render, for one) reads its configuration from the dashboard, not
 * from the .env file, which never leaves the developer's machine. Setting
 * DEV_API_TOKEN in the environment replaces this value; setting it to an empty
 * string turns development-token access off entirely.
 */
const FALLBACK_DEV_TOKEN = 'ed290bd7895e494b883dd5c7d7faee1ba64d487371e9071e';

/**
 * Every token that may be used in place of a Clerk JWT. DEV_API_TOKEN holds a
 * comma-separated list so several environments (local, staging, QA) can each
 * carry their own token.
 */
export function getDevTokens(): string[] {
  const configured = process.env.DEV_API_TOKEN;

  return (configured === undefined ? FALLBACK_DEV_TOKEN : configured)
    .split(',')
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

export function isDevAuthEnabled(): boolean {
  return getDevTokens().length > 0;
}

function timingSafeMatch(candidate: string, known: string): boolean {
  if (candidate.length !== known.length) {
    return false;
  }

  let mismatch = 0;
  for (let i = 0; i < candidate.length; i += 1) {
    mismatch |= candidate.charCodeAt(i) ^ known.charCodeAt(i);
  }

  return mismatch === 0;
}

export function isDevToken(token: string | undefined | null): boolean {
  if (!token) {
    return false;
  }

  return getDevTokens().some((known) => timingSafeMatch(token, known));
}

function headerValue(req: Request, name: string): string | undefined {
  const raw = req.headers[name];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value?.trim() || undefined;
}

/**
 * Reads the development token from either the dedicated `x-dev-token` header
 * or the standard `Authorization: Bearer <token>` header.
 */
export function extractDevToken(req: Request): string | undefined {
  const dedicated = headerValue(req, DEV_TOKEN_HEADER);
  if (dedicated) {
    return dedicated;
  }

  const authHeader = headerValue(req, 'authorization');
  if (authHeader?.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim() || undefined;
  }

  return undefined;
}

export function hasValidDevToken(req: Request): boolean {
  return isDevToken(extractDevToken(req));
}

/**
 * The synthetic claims attached to `req.auth` for development-token callers, so
 * downstream code sees the same shape it gets from a verified Clerk JWT.
 */
export function buildDevAuthClaims(req: Request): Record<string, unknown> {
  return {
    sub: 'dev-token-user',
    email: headerValue(req, 'x-user-email')?.toLowerCase(),
    isDevToken: true,
  };
}
