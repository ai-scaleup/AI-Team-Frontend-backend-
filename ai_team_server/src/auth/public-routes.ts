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
  // Clerk webhook: authenticated by its own Svix signature headers.
  // POST /webhooks/clerk
  { method: 'POST', pattern: /^\/webhooks\/clerk$/ },

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
 * Route prefixes this middleware leaves alone. The Chiara WhatsApp and Chiara
 * Vanessa lead endpoints currently run with no authentication at all — the
 * development token requirement was lifted, so anyone who knows the URL can
 * read and write the leads. Restore DevTokenMiddleware on
 * ChiaraWhatsappController and ChiaraVanessaController to close them again.
 */
const PUBLIC_PATH_PREFIXES: RegExp[] = [
  /^\/chiara-whatsapp(\/.*)?$/,
  /^\/chiara-vanessa(\/.*)?$/,
];

/**
 * The Swagger UI itself and the JSON documents behind it. Authentication now
 * covers every route, and the docs page is mounted on the same Express
 * instance, so it has to be reachable without a credential — otherwise there
 * is no page on which to press Authorize.
 */
const DOCS_PATHS = [/^\/api(\/.*)?$/, /^\/api-json$/, /^\/api-yaml$/];

function isDocsRequest(method: string, path: string): boolean {
  return (
    (method === 'GET' || method === 'HEAD') &&
    DOCS_PATHS.some((pattern) => pattern.test(path))
  );
}

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

  if (isDocsRequest(method, path)) {
    return true;
  }

  if (PUBLIC_PATH_PREFIXES.some((pattern) => pattern.test(path))) {
    return true;
  }

  return PUBLIC_ROUTES.some(
    (route) => route.method === method && route.pattern.test(path),
  );
}
