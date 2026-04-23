import GiuliaWidget from '@/components/ui/GiuliaWidget';
import TokenAlertsAnnouncer from '@/components/ui/TokenAlertsAnnouncer';
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
      {children}

      <TokenAlertsAnnouncer />
      {/* Mount Giulia widget globally on all dashboard pages */}
      <GiuliaWidget />
    </>
  );
}
