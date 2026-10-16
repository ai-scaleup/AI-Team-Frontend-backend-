import type { Metadata } from "next";
import { agencyBrandingForId } from "@/lib/agencyHost";
import { AgencySessionProvider } from "@/lib/session";

// An agency's sign-in pages on the AI Team address: /agency-login/<agencyId>
// and /agency-login/<agencyId>/setup?code=… (the link an agency gives its
// customer). The agency id in the address picks the branding.

type Props = { children: React.ReactNode; params: Promise<{ agencyId: string }> };

export async function generateMetadata({ params }: Omit<Props, "children">): Promise<Metadata> {
  const branding = await agencyBrandingForId((await params).agencyId);
  if (!branding) return { title: "Sign in" };
  return {
    title: branding.productName,
    description: branding.productName,
    ...(branding.logoDataUrl ? { icons: { icon: branding.logoDataUrl } } : {}),
  };
}

export default async function AgencySignInLayout({ children, params }: Props) {
  const branding = await agencyBrandingForId((await params).agencyId);
  // Without branding the pages show that the link is not valid.
  if (!branding) return <>{children}</>;
  return (
    <AgencySessionProvider branding={branding} signInPage>
      {children}
    </AgencySessionProvider>
  );
}
