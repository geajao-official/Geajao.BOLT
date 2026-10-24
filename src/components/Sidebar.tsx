import { useState } from 'react';
import {
  Home,
  MessageCircle,
  Users,
  MoreHorizontal,
  X,
  LogOut,
  User,
} from 'lucide-react';

export type SidebarView = 'feed' | 'chat' | 'friends' | 'profile';

interface SidebarProps {
  active?: SidebarView;
  activePage?: SidebarView;
  viewedUserId?: string | null;
  onNavigate?: (view: SidebarView) => void;
  onSignOut?: () => void;
  profile?: any;
}

export default function Sidebar({
  active,
  activePage,
  viewedUserId,
  onNavigate,
  onSignOut,
  profile,
}: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Safely fallback to whichever active prop is passed
  const currentView: SidebarView = active || activePage || 'feed';

  const navigationItems: { id: SidebarView; label: string; icon: typeof Home }[] = [
    { id: 'feed', label: 'Feed', icon: Home },
    { id: 'chat', label: 'Messages', icon: MessageCircle },
    { id: 'friends', label: 'Friends', icon: Users },
  ];

  const handleNavigate = (page: SidebarView) => {
    if (onNavigate) {
      onNavigate(page);
    }
    setIsOpen(false);
  };

  const handleLogout = () => {
    if (onSignOut) {
      onSignOut();
    }
    setIsOpen(false);
  };

  // Only highlight Profile button when on profile view AND viewing own profile
  const isMyProfileActive =
    currentView === 'profile' &&
    (!viewedUserId || viewedUserId === profile?.id);

  return (
    <>
      {/* Mobile menu button */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Open navigation menu"
        aria-expanded={isOpen}
        className="fixed right-4 top-4 z-40 flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/30 bg-[#0a0f24]/90 text-amber-300 shadow-lg backdrop-blur-md transition-all duration-200 hover:scale-105 hover:bg-[#101733] active:scale-95 lg:hidden"
      >
        <MoreHorizontal size={22} />
      </button>

      {/* Mobile backdrop */}
      {isOpen && (
        <button
          type="button"
          aria-label="Close navigation menu"
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-40 bg-[#060913]/80 backdrop-blur-sm transition-opacity duration-300 lg:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-amber-500/20 bg-[#0a0f24]/95 text-amber-50 shadow-2xl backdrop-blur-xl transition-transform duration-300 ease-out lg:z-30 lg:w-64 lg:translate-x-0 lg:shadow-none ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Ambient glows */}
        <div className="pointer-events-none absolute -left-20 -top-20 h-48 w-48 rounded-full bg-amber-600/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -right-20 h-48 w-48 rounded-full bg-amber-700/10 blur-3xl" />

        {/* Header */}
        <div className="relative flex h-16 shrink-0 items-center justify-between border-b border-amber-500/20 px-5">
          <button
            type="button"
            onClick={() => handleNavigate('feed')}
            className="text-xl font-extrabold tracking-wide text-amber-100 transition-transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <span className="bg-gradient-to-r from-amber-100 via-amber-300 to-amber-200 bg-clip-text text-transparent">
              Geajao
            </span>
          </button>

          <button
            type="button"
            onClick={() => setIsOpen(false)}
            aria-label="Close navigation menu"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-amber-400/60 transition hover:bg-amber-500/10 hover:text-amber-200 lg:hidden"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 space-y-1.5 overflow-y-auto p-4">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigate(item.id)}
                className={`group relative flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold transition-all duration-200 ${
                  isActive
                    ? 'border border-amber-400/40 bg-gradient-to-r from-amber-400 to-amber-600 font-bold text-slate-950 shadow-md shadow-amber-500/20'
                    : 'text-amber-200/70 hover:bg-amber-500/10 hover:text-amber-100'
                }`}
              >
                <div className="transition-transform duration-200 group-hover:scale-110">
                  <Icon size={20} />
                </div>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Bottom Actions (Profile & Logout) */}
        <div className="space-y-1.5 border-t border-amber-500/20 p-4">
          {/* Lower Profile Button with User Icon (No Avatar Pic) */}
          <button
            type="button"
            onClick={() => handleNavigate('profile')}
            className={`group relative flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold transition-all duration-200 ${
              isMyProfileActive
                ? 'border border-amber-400/40 bg-gradient-to-r from-amber-400 to-amber-600 font-bold text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-amber-200/70 hover:bg-amber-500/10 hover:text-amber-100'
            }`}
          >
            <div className="transition-transform duration-200 group-hover:scale-110">
              <User size={20} />
            </div>
            <span>Profile</span>
          </button>

          {/* Logout Button */}
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium text-amber-400/60 transition-all duration-200 hover:translate-x-0.5 hover:bg-rose-500/10 hover:text-rose-400"
          >
            <LogOut size={19} />
            <span>Log out</span>
          </button>
        </div>
      </aside>
    </>
  );
}