import { useState, type ReactNode } from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import WelcomePage from '@/pages/WelcomePage';
import AuthPage from '@/pages/AuthPage';
import VerificationPage from '@/pages/VerificationPage';
import FeedPage from '@/pages/FeedPage';
import ProfilePage from '@/pages/ProfilePage';
import FriendsPage from '@/pages/FriendsPage';
import ChatPage from '@/pages/ChatPage';
import AdminPinPage from '@/pages/AdminPinPage';
import AdminPanel from '@/pages/AdminPanel';
import AppShell from '@/components/AppShell';
import NotificationBell from '@/components/NotificationBell';
import { NotificationLinkType } from '@/types';
import { Loader2 } from 'lucide-react';

type Page = 'welcome' | 'auth' | 'admin-pin' | 'admin-panel';
type View = 'feed' | 'profile' | 'friends' | 'chat' | 'settings';
type AdminRole = 'admin' | 'moderator';

function AppContent() {
  const { user, profile, loading, signOut } = useAuth();
  const [page, setPage] = useState<Page>('welcome');
  const [adminPin, setAdminPin] = useState('');
  const [adminRole, setAdminRole] = useState<AdminRole>('admin');
  const [view, setView] = useState<View>('feed');
  const [chatFriendId, setChatFriendId] = useState<string | null>(null);
  const [viewedUserId, setViewedUserId] = useState<string | null>(null);
  const [chatConversationId, setChatConversationId] = useState<string | null>(
    null,
  );
  const [chatGroupId, setChatGroupId] = useState<string | null>(null);

  const handleNotificationNavigate = (
    linkType: NotificationLinkType,
    linkId: string | null,
    actorId: string | null,
  ) => {
    if (linkType === 'conversation' && linkId) {
      setChatConversationId(linkId);
      setChatGroupId(null);
      setChatFriendId(null);
      setView('chat');
    } else if (linkType === 'group' && linkId) {
      setChatGroupId(linkId);
      setChatConversationId(null);
      setChatFriendId(null);
      setView('chat');
    } else if (linkType === 'profile' && actorId) {
      setViewedUserId(actorId);
      setView('profile');
    } else if (linkType === 'profile' && linkId) {
      setViewedUserId(linkId);
      setView('profile');
    }
  };

  const handleAppShellNavigate = (nextView: string) => {
    if (nextView === 'profile') {
      // Clear viewedUserId so navigating to profile defaults to own profile
      setViewedUserId(null);
      setView('profile');
    } else if (nextView === 'feed' || nextView === 'friends' || nextView === 'chat' || nextView === 'settings') {
      setView(nextView as View);
    }
  };

  const bell = <NotificationBell onNavigate={handleNotificationNavigate} />;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-950">
        <Loader2 size={32} className="animate-spin text-accent" />
      </div>
    );
  }

  if (page === 'admin-pin') {
    return (
      <AdminPinPage
        onBack={() => setPage('auth')}
        onSuccess={(pin: string, role: AdminRole) => {
          setAdminPin(pin);
          setAdminRole(role);
          setPage('admin-panel');
        }}
      />
    );
  }

  if (page === 'admin-panel') {
    if (adminRole === 'moderator' && (!user || !profile)) {
      return (
        <AuthPage
          onBack={() => {
            setAdminPin('');
            setAdminRole('admin');
            setPage('welcome');
          }}
          onAdminAccess={() => setPage('admin-pin')}
        />
      );
    }

    return (
      <AdminPanel
        pin={adminPin}
        role={adminRole}
        onExit={() => {
          setAdminPin('');
          setAdminRole('admin');
          setPage('welcome');
        }}
      />
    );
  }

  if (!user || !profile) {
    if (page === 'auth') {
      return (
        <AuthPage
          onBack={() => setPage('welcome')}
          onAdminAccess={() => setPage('admin-pin')}
        />
      );
    }

    return <WelcomePage onGetIn={() => setPage('auth')} />;
  }

  const isBlocked = profile.is_blocked;
  const isRestricted =
    profile.restricted_until &&
    new Date(profile.restricted_until) > new Date();
  const isVerified = profile.verification_status === 'verified';

  if (isBlocked || isRestricted || !isVerified) {
    return <VerificationPage onSignOut={signOut} />;
  }

  const handleSignOut = async () => {
    await signOut();
    setView('feed');
    setPage('welcome');
  };

  const wrap = (node: ReactNode) => (
    <AppShell
      active={(view === 'settings' ? 'feed' : view) as import('@/components/Sidebar').SidebarView}
      viewedUserId={viewedUserId}
      onNavigate={handleAppShellNavigate}
      onSignOut={handleSignOut}
      bell={bell}
    >
      {node}
    </AppShell>
  );

  if (view === 'profile') {
    return wrap(
      <ProfilePage
        viewedUserId={viewedUserId}
        onBack={() => {
          setViewedUserId(null);
          setView('feed');
        }}
        onSignOut={handleSignOut}
        onOpenProfile={(userId: string) => setViewedUserId(userId)}
        notificationBell={bell}
      />,
    );
  }

  if (view === 'friends') {
    return wrap(
      <FriendsPage
        onBack={() => setView('feed')}
        onSignOut={handleSignOut}
        onOpenProfile={(userId: string) => {
          setViewedUserId(userId);
          setView('profile');
        }}
        onStartChat={(friendId: string) => {
          setChatFriendId(friendId);
          setView('chat');
        }}
        notificationBell={bell}
      />,
    );
  }

  if (view === 'chat') {
    return wrap(
      <ChatPage
        onBack={() => {
          setChatFriendId(null);
          setChatConversationId(null);
          setChatGroupId(null);
          setView('feed');
        }}
        onSignOut={handleSignOut}
        initialFriendId={chatFriendId}
        initialConversationId={chatConversationId}
        initialGroupId={chatGroupId}
        onOpenProfile={(userId: string) => {
          setViewedUserId(userId);
          setView('profile');
        }}
        notificationBell={bell}
      />,
    );
  }

  return wrap(
    <FeedPage
      onSignOut={handleSignOut}
      onViewProfile={() => {
        setViewedUserId(null);
        setView('profile');
      }}
      onViewUserProfile={(userId: string) => {
        setViewedUserId(userId);
        setView('profile');
      }}
      onViewFriends={() => setView('friends')}
      onViewChat={() => {
        setChatFriendId(null);
        setChatConversationId(null);
        setChatGroupId(null);
        setView('chat');
      }}
      notificationBell={bell}
    />,
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
