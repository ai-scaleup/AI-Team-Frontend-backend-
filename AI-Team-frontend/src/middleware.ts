import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// Define protected routes (dashboard and all its sub-routes)
const isProtectedRoute = createRouteMatcher(['/dashboard(.*)']);

export default clerkMiddleware(async (auth, req) => {
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

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    '/((?!_next|[^?]*\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
