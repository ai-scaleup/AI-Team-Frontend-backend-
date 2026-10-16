"use client";

// ===================================================
// Signed-in user, Clerk or agency (lib/session.tsx)
// Drop-in for the client parts of "@clerk/nextjs" that the app uses. On the
// platform (ai-team.biz) every export simply is Clerk's. In agency mode
// (lib/agencyHost.ts) there is no Clerk at all: the user is an agency customer
// signed in with our own password login, and these exports return the same
// shapes (user.id, user.primaryEmailAddress, getToken, …) built from that
// session.
//
// The mode is decided by the server for the whole page load, so it never
// changes while a page is open; that is what makes the mode switch inside the
// hooks below safe.
// ===================================================

import * as Clerk from "@clerk/nextjs";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ComponentProps, ReactNode } from "react";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { registerApiTokenGetter } from "./authenticatedFetch";
import { clearConversationCaches } from "./conversationCache";
import { withoutAgencyPrefix } from "./agencyHost";
import type { AgencyBranding } from "./agencyHost";

type ClerkUserHook = ReturnType<typeof Clerk.useUser>;
type ClerkAuthHook = ReturnType<typeof Clerk.useAuth>;

/** `email` is the customer's own User email (used for calls, so they only reach
 * their own data); `loginEmail` is the email they sign in with, for showing. */
export type AgencyCustomer = { id: string; email: string; loginEmail?: string; name: string };

type AgencyState = {
  branding: AgencyBranding | null;
  customer: AgencyCustomer | null;
  userHook: ClerkUserHook;
  authHook: ClerkAuthHook;
  signOut: () => Promise<void>;
};

const AgencyContext = createContext<AgencyState | null>(null);

/** The agency's branding for an agency customer, null on the platform. */
export function useAgencyBranding(): AgencyBranding | null {
  return useContext(AgencyContext)?.branding ?? null;
}

/** True in agency mode (an agency customer, or an agency's sign-in page). */
export function useIsAgencyAddress(): boolean {
  return useContext(AgencyContext) !== null;
}

async function signOutAgency(loginPath: string) {
  try {
    await fetch("/api/agency-auth/logout", { method: "POST" });
  } finally {
    window.location.href = loginPath;
  }
}

/**
 * Wraps the whole app for an agency customer, in place of ClerkProvider.
 * With `signInPage` it only brands the agency's sign-in pages: no session is
 * read and nothing on the device is touched.
 */
export function AgencySessionProvider({
  branding, signInPage = false, children,
}: {
  branding: AgencyBranding;
  signInPage?: boolean;
  children: ReactNode;
}) {
  const [loaded, setLoaded] = useState(signInPage);
  const [customer, setCustomer] = useState<AgencyCustomer | null>(null);
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (signInPage) return;
    let cancelled = false;
    fetch("/api/agency-auth/session", { cache: "no-store" })
      .then(async (res) => (res.ok ? ((await res.json()) as { token: string; user: AgencyCustomer }) : null))
      .catch(() => null)
      .then((session) => {
        if (cancelled) return;
        tokenRef.current = session?.token ?? null;
        setCustomer(session?.user ?? null);
        setLoaded(true);
        // A session that ended (expired, reset, seat removed) goes back to sign-in.
        if (!session && withoutAgencyPrefix(window.location.pathname).startsWith("/dashboard")) {
          window.location.href = branding.loginPath;
        }
      });
    return () => { cancelled = true; };
  }, [signInPage, branding.loginPath]);

  const getToken = useCallback(async () => tokenRef.current, []);

  // Backend calls through authenticatedFetch carry the agency session token.
  useEffect(() => {
    if (loaded && !signInPage) return registerApiTokenGetter(getToken);
  }, [loaded, signInPage, getToken]);

  // Chats cached on this device belong to whoever is signed in.
  useEffect(() => {
    if (loaded && !signInPage) clearConversationCaches(customer?.id);
  }, [loaded, signInPage, customer?.id]);

  const signOut = useCallback(() => signOutAgency(branding.loginPath), [branding.loginPath]);

  // Built once per sign-in, so pages that depend on `user` do not re-run.
  const value = useMemo<AgencyState>(() => {
    const user = customer
      ? {
          id: customer.id,
          username: null,
          fullName: customer.name,
          firstName: customer.name,
          lastName: null,
          imageUrl: "",
          hasImage: false,
          primaryEmailAddress: { id: "primary", emailAddress: customer.email },
          primaryEmailAddressId: "primary",
          emailAddresses: [{ id: "primary", emailAddress: customer.email }],
          createdAt: null,
          updatedAt: null,
        }
      : null;
    const userHook = { isLoaded: loaded, isSignedIn: Boolean(user), user } as unknown as ClerkUserHook;
    const authHook = {
      isLoaded: loaded,
      isSignedIn: Boolean(customer),
      userId: customer?.id ?? null,
      sessionId: customer ? "agency" : null,
      orgId: null,
      orgRole: null,
      orgSlug: null,
      actor: null,
      has: () => false,
      getToken,
      signOut,
    } as unknown as ClerkAuthHook;
    return { branding, customer, userHook, authHook, signOut };
  }, [branding, customer, loaded, getToken, signOut]);

  return <AgencyContext.Provider value={value}>{children}</AgencyContext.Provider>;
}

/* ── drop-ins for @clerk/nextjs ── */

export function useUser(): ClerkUserHook {
  const agency = useContext(AgencyContext);
  // eslint-disable-next-line react-hooks/rules-of-hooks -- fixed per page, see the top of this file
  return agency ? agency.userHook : Clerk.useUser();
}

export function useAuth(): ClerkAuthHook {
  const agency = useContext(AgencyContext);
  // eslint-disable-next-line react-hooks/rules-of-hooks -- fixed per page, see the top of this file
  return agency ? agency.authHook : Clerk.useAuth();
}

export function UserButton(props: ComponentProps<typeof Clerk.UserButton>) {
  const agency = useContext(AgencyContext);
  if (!agency) return <Clerk.UserButton {...props} />;
  return <AgencyUserButton customer={agency.customer} color={agency.branding?.primaryColor} onSignOut={agency.signOut} />;
}

export function SignedIn({ children }: { children: ReactNode }) {
  const agency = useContext(AgencyContext);
  if (!agency) return <Clerk.SignedIn>{children}</Clerk.SignedIn>;
  return agency.customer ? <>{children}</> : null;
}

export function SignedOut({ children }: { children: ReactNode }) {
  const agency = useContext(AgencyContext);
  if (!agency) return <Clerk.SignedOut>{children}</Clerk.SignedOut>;
  return agency.userHook.isLoaded && !agency.customer ? <>{children}</> : null;
}

export function SignInButton(props: ComponentProps<typeof Clerk.SignInButton>) {
  const agency = useContext(AgencyContext);
  if (!agency) return <Clerk.SignInButton {...props} />;
  return <Link href={agency.branding?.loginPath ?? "/"}>{props.children ?? "Sign in"}</Link>;
}

export function SignUpButton(props: ComponentProps<typeof Clerk.SignUpButton>) {
  const agency = useContext(AgencyContext);
  if (!agency) return <Clerk.SignUpButton {...props} />;
  return <Link href={agency.branding?.loginPath ?? "/"}>{props.children ?? "Sign in"}</Link>;
}

function AgencyUserButton({
  customer, color, onSignOut,
}: {
  customer: AgencyCustomer | null;
  color?: string;
  onSignOut: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  if (!customer) return null;
  const initials = customer.name.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?";
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white ring-2 ring-white/10"
        style={{ background: color ?? "#0ea5e9" }}
        aria-label="Account"
      >
        {initials}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-white/10 bg-[#0B1221] p-2 text-left shadow-2xl shadow-black/50">
          <div className="px-3 py-2">
            <p className="truncate text-sm font-medium text-white">{customer.name}</p>
            <p className="truncate text-xs text-white/50">{customer.loginEmail ?? customer.email}</p>
          </div>
          <button
            type="button"
            onClick={() => void onSignOut()}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/70 transition hover:bg-white/5 hover:text-white"
          >
            <LogOut size={14} /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
