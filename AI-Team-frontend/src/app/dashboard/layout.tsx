import AgentAccessGuard from '@/components/ui/AgentAccessGuard';
import GiuliaWidget from '@/components/ui/GiuliaWidget';
import TokenAlertsAnnouncer from '@/components/ui/TokenAlertsAnnouncer';
import UserSync from '@/components/ui/UserSync';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';


export const metadata: Metadata = {
  title: 'Dashboard – AI Team',
  description: 'Your AI Team dashboard',
};

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
      {/* Mount Giulia widget globally on all dashboard pages */}
      <GiuliaWidget />
    </>
  );
}
