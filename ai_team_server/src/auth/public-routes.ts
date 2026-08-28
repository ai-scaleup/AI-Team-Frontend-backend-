// ===================================================
// Public routes (auth/public-routes.ts)
// The handful of endpoints that must answer without a Clerk JWT or the
// development token. They are called by the n8n workflow, which runs
// server-to-server and carries no user session, so AuthMiddleware lets them
// through untouched.
//
// Keep this list as small as the workflow needs: every entry here is reachable
// by anyone who knows the URL.
// ===================================================
import { Request } from 'express';

type PublicRoute = {
  method: string;
  pattern: RegExp;
};

const PUBLIC_ROUTES: PublicRoute[] = [
  // Records what a workflow run spent:
  // PATCH /token-usage/{email}/{agentName}/usage
  { method: 'PATCH', pattern: /^\/token-usage\/[^/]+\/[^/]+\/usage$/ },

  // Reads a conversation's token counters before the run is added to them:
  // GET /conversations/by-id/{conversationId}
  { method: 'GET', pattern: /^\/conversations\/by-id\/[^/]+$/ },

  // Writes the new counters back:
  // PATCH /conversations/{conversationId}/tokens
  { method: 'PATCH', pattern: /^\/conversations\/[^/]+\/tokens$/ },
];

/**
 * Strips the query string and any trailing slash so the patterns above can be
 * written against the bare path.
 */
function normalizePath(url: string): string {
  const path = url.split('?')[0].split('#')[0];
  return path.replace(/\/+$/, '') || '/';
}

export function isPublicRoute(req: Request): boolean {
  const method = (req.method ?? '').toUpperCase();
  const path = normalizePath(req.path ?? req.url ?? '');

  return PUBLIC_ROUTES.some(
    (route) => route.method === method && route.pattern.test(path),
  );
}
