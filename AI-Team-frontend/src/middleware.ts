import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import type { NextFetchEvent, NextRequest } from 'next/server';
import { AGENCY_SESSION_COOKIE, agencyBrandingForSlug, agencyForRequest, agencyPrefix } from '@/lib/agencyHost';
import type { AgencyBranding } from '@/lib/agencyHost';

// Define protected routes (dashboard and all its sub-routes)
const isProtectedRoute = createRouteMatcher(['/dashboard(.*)']);

const platformMiddleware = clerkMiddleware(async (auth, req) => {
  // An agency's pages under its name (/<slug>…), for a visitor not signed in
  // to that agency.
  const agencyPage = await agencyPathRoute(req, null);
  if (agencyPage) return agencyPage;

  // Dashboard routes always require a real Clerk session. Development API
  // tokens may authenticate backend integrations, but never browser access.
  if (isProtectedRoute(req)) {
    const { userId } = await auth();

    // If user is not authenticated, redirect to landing page
    if (!userId) {
      const landingUrl = new URL('/', req.url);
      return NextResponse.redirect(landingUrl);
    }
  }

  // Allow the request to continue
  return NextResponse.next();
});

// Platform-only areas never open for an agency customer.
const PLATFORM_ONLY_PAGES = /^\/(dashboard\/(admin|agency|pearl-admin|tokenviewer_admin)|box)(\/|$)/;
const PLATFORM_ONLY_API = /^\/api\/(admin|chiara-admin|pearl-admin)(\/|$)/;

// First path segments of the app itself, never an agency's name.
const APP_SEGMENTS = new Set(['agency-login', 'api', 'assets', 'box', 'dashboard', 'sign-in', 'sign-up', 'trpc', 'tv-hook']);

function urlFor(req: NextRequest, pathname: string, keepQuery = true) {
  const url = req.nextUrl.clone();
  url.pathname = pathname;
  if (!keepQuery) url.search = '';
  return url;
}

/**
 * An agency on the AI Team address lives under its name (lib/agencyHost.ts):
 *   /<slug>               its sign-in page, or its dashboard when signed in
 *   /<slug>/setup?code=…  a setup link
 *   /<slug>/dashboard/…   the app, served by /dashboard/… with the address kept
 * `signedInAgencyId` is the agency the visitor is signed in to, if any. Null
 * when the path is not an agency's.
 */
async function agencyPathRoute(req: NextRequest, signedInAgencyId: string | null): Promise<NextResponse | null> {
  const [, slug, ...rest] = req.nextUrl.pathname.split('/');
  if (!slug || APP_SEGMENTS.has(slug)) return null;
  const agency = await agencyBrandingForSlug(slug);
  if (!agency) return null;

  const sub = `/${rest.join('/')}`.replace(/(.)\/+$/, '$1');
  const signedInHere = signedInAgencyId === agency.agencyId;

  if (sub === '/') {
    return signedInHere
      ? NextResponse.redirect(urlFor(req, `/${slug}/dashboard`, false))
      : NextResponse.rewrite(urlFor(req, `/agency-login/${agency.agencyId}`));
  }
  if (sub === '/setup') {
    return NextResponse.rewrite(urlFor(req, `/agency-login/${agency.agencyId}/setup`));
  }
  if (/^\/dashboard(\/|$)/.test(sub)) {
    if (!signedInHere) return NextResponse.redirect(urlFor(req, `/${slug}`, false));
    if (PLATFORM_ONLY_PAGES.test(sub)) return NextResponse.redirect(urlFor(req, `/${slug}/dashboard`, false));
    return NextResponse.rewrite(urlFor(req, sub));
  }
  return null;
}

/**
 * An agency customer (lib/agencyHost.ts): no Clerk. Customers sign in on the
 * agency's login page (branding.loginPath); the session cookie is checked by
 * the backend on every call, so its presence here only decides where to send
 * the visitor. On the AI Team address the app's own /dashboard links are sent
 * on to /<slug>/dashboard.
 */
async function agencyMiddleware(req: NextRequest, branding: AgencyBranding) {
  const path = req.nextUrl.pathname;
  const signedIn = Boolean(req.cookies.get(AGENCY_SESSION_COOKIE)?.value);
  const prefix = agencyPrefix(branding);

  if (PLATFORM_ONLY_API.test(path)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (prefix) {
    const agencyPage = await agencyPathRoute(req, branding.agencyId);
    if (agencyPage) return agencyPage;
  }
  if (PLATFORM_ONLY_PAGES.test(path)) {
    return NextResponse.redirect(urlFor(req, signedIn ? `${prefix}/dashboard` : branding.loginPath, false));
  }
  if (path === '/') {
    if (prefix) return NextResponse.redirect(urlFor(req, `${prefix}/dashboard`, false));
    return signedIn
      ? NextResponse.redirect(urlFor(req, '/dashboard', false))
      : NextResponse.rewrite(urlFor(req, '/agency-login'));
  }
  if (isProtectedRoute(req)) {
    if (!signedIn) return NextResponse.redirect(urlFor(req, branding.loginPath, false));
    if (prefix) return NextResponse.redirect(urlFor(req, `${prefix}${path}`));
  }
  return NextResponse.next();
}

export default async function middleware(req: NextRequest, event: NextFetchEvent) {
  const agency = await agencyForRequest(req.headers.get('host'), req.cookies);
  if (agency) {
    return agencyMiddleware(req, agency);
  }
  return platformMiddleware(req, event);
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    '/((?!_next|[^?]*\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
