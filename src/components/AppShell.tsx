import { type ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import Sidebar from '@/components/Sidebar';
import type { SidebarView } from '@/components/Sidebar';

interface AppShellProps {
  active: SidebarView;
  onNavigate: (view: SidebarView) => void;
  onSignOut: () => void;
  bell: ReactNode;
  children: ReactNode;
}

export default function AppShell({
  active,
  onNavigate,
  onSignOut,
  bell,
  children,
}: AppShellProps) {
  const { profile } = useAuth();

  return (
    <div className="min-h-screen w-full min-w-0 bg-ink-950">
      <Sidebar
        active={active}
        onNavigate={onNavigate}
        onSignOut={onSignOut}
        profile={profile}
      />

      <main className="min-h-screen w-full min-w-0 pl-0 lg:ml-64 lg:w-auto">
        {children}
      </main>
    </div>
  );
}