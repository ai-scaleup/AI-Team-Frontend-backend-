import AgentAccessGuard from '@/components/ui/AgentAccessGuard';
import GiuliaWidget from '@/components/ui/GiuliaWidget';
import PlatformOnly from '@/components/ui/PlatformOnly';
import TokenAlertsAnnouncer from '@/components/ui/TokenAlertsAnnouncer';
import UserSync from '@/components/ui/UserSync';
import type { Metadata } from 'next';
import { requestAgency } from '@/lib/serverSession';

export const dynamic = 'force-dynamic';


export async function generateMetadata(): Promise<Metadata> {
  // For an agency customer the tab shows the agency's product name.
  const branding = await requestAgency();
  if (branding) {
    return { title: `Dashboard – ${branding.productName}`, description: branding.productName };
  }
  return {
    title: 'Dashboard – AI Team',
    description: 'Your AI Team dashboard',
  };
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* Your existing dashboard shell/header/sidebar goes here */}
      {/* An agent page only renders for a user the agent is assigned to. */}
      <AgentAccessGuard>{children}</AgentAccessGuard>

      <UserSync />
      <TokenAlertsAnnouncer />
      {/* Mount Giulia widget globally on all dashboard pages (AI Team's own
          assistant, so not on an agency's branded address) */}
      <PlatformOnly>
        <GiuliaWidget />
      </PlatformOnly>
    </>
  );
}
