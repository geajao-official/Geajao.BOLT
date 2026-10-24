import { useEffect, useState, useCallback } from 'react';
import {
  getFriendRequests, getSentRequests, getFriends, getDiscoverUsers,
  acceptFriendRequest, declineFriendRequest, removeFriend, sendFriendRequest,
} from '@/lib/friends';
import { FriendRequest, SentRequest, Friend, DiscoverUser } from '@/types';
import Avatar from '@/components/Avatar';
import { BadgeRow } from '@/components/Badge';
import {
  ArrowLeft, Users, UserCheck, UserPlus, Check, X, UserMinus, Loader2,
  MessageCircle, Search, UserSearch, Sparkles,
} from 'lucide-react';

interface FriendsPageProps {
  onBack: () => void;
  onSignOut: () => void;
  onStartChat: (friendId: string) => void;
  onOpenProfile: (userId: string) => void;
  notificationBell?: React.ReactNode;
}

type Tab = 'discover' | 'requests' | 'friends' | 'sent';

export default function FriendsPage({ onBack, onSignOut: _onSignOut, onStartChat, onOpenProfile, notificationBell }: FriendsPageProps) {
  const [tab, setTab] = useState<Tab>('discover');
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<SentRequest[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [discoverUsers, setDiscoverUsers] = useState<DiscoverUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const fetchAll = useCallback(async () => {
    try {
      const [reqs, sent, frnds, discover] = await Promise.all([
        getFriendRequests(), getSentRequests(), getFriends(), getDiscoverUsers(),
      ]);
      setRequests(reqs);
      setSentRequests(sent);
      setFriends(frnds);
      setDiscoverUsers(discover);
    } catch (err) {
      console.error('Failed to fetch friend data:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const runAction = async (key: string, action: () => Promise<unknown>) => {
    setActionLoading(key);
    try { await action(); await fetchAll(); }
    catch (err) { console.error('Friend action failed:', err); }
    finally { setActionLoading(null); }
  };

  const filteredDiscover = discoverUsers.filter((u) =>
    u.full_name.toLowerCase().includes(search.toLowerCase()) ||
    u.username.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="friends-shell relative min-h-screen overflow-hidden bg-[#060913] text-amber-50">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="friends-glow absolute -left-36 -top-36 h-[28rem] w-[28rem] rounded-full bg-amber-600/[0.12] blur-[110px]" />
        <div className="friends-glow friends-glow-delay absolute -right-40 top-[28%] h-[32rem] w-[32rem] rounded-full bg-amber-700/[0.10] blur-[120px]" />
        <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(245,158,11,.12)_1px,transparent_1px),linear-gradient(90deg,rgba(245,158,11,.12)_1px,transparent_1px)] [background-size:44px_44px]" />
      </div>

      <header className="sticky top-0 z-30 border-b border-amber-500/20 bg-[#0a0f24]/90 shadow-lg shadow-black/40 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <button onClick={onBack} aria-label="Go back" className="group rounded-xl border border-amber-500/20 bg-[#0c1126] p-2.5 text-amber-400/80 transition hover:border-amber-400/50 hover:bg-amber-500/10 hover:text-amber-200">
              <ArrowLeft size={19} className="transition-transform group-hover:-translate-x-0.5" />
            </button>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-400/20 to-amber-600/20 text-amber-300 shadow-md">
              <Users size={20} />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-100 via-amber-300 to-amber-200 sm:text-xl">Geajao</h1>
              <p className="hidden text-xs font-medium text-amber-500/60 sm:block">Find your people. Stay connected.</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-4">
            {notificationBell}
          </div>
        </div>

        <div className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 sm:px-6">
          <TabButton active={tab === 'discover'} onClick={() => setTab('discover')} icon={<UserSearch size={16} />} label="Discover" />
          <TabButton active={tab === 'requests'} onClick={() => setTab('requests')} icon={<UserPlus size={16} />} label="Requests" badge={requests.length} />
          <TabButton active={tab === 'friends'} onClick={() => setTab('friends')} icon={<UserCheck size={16} />} label="Friends" badge={friends.length} />
          <TabButton active={tab === 'sent'} onClick={() => setTab('sent')} icon={<Users size={16} />} label="Sent" badge={sentRequests.length} />
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-5xl px-4 pb-16 pt-7 sm:px-6 sm:pt-10">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-300">
              <Sparkles size={12} /> Social space
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-amber-100 sm:text-3xl">{tab === 'discover' ? 'Discover people' : tab === 'requests' ? 'Friend requests' : tab === 'friends' ? 'Your friends' : 'Sent requests'}</h2>
            <p className="mt-1.5 text-sm font-medium text-amber-400/60">{tab === 'discover' ? 'Meet people and grow your circle.' : tab === 'requests' ? 'People who would like to connect with you.' : tab === 'friends' ? 'Keep the conversation going.' : 'Requests waiting for a response.'}</p>
          </div>
          <div className="hidden rounded-2xl border border-amber-500/20 bg-[#0c1126]/90 px-4 py-3 text-right shadow-lg sm:block">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-amber-500/60">Connections</p>
            <p className="mt-0.5 text-xl font-extrabold tabular-nums text-amber-200">{friends.length}<span className="ml-1 text-xs font-medium text-amber-400/60">friends</span></p>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-64 items-center justify-center rounded-3xl border border-amber-500/20 bg-[#0c1126]/80">
            <div className="flex flex-col items-center gap-3 text-amber-400/60"><Loader2 size={28} className="animate-spin text-amber-400" /><span className="text-xs font-medium tracking-wide">Loading your network…</span></div>
          </div>
        ) : tab === 'discover' ? (
          <>
            <div className="group relative mb-5">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-500/60 transition group-focus-within:text-amber-300" />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or username…" className="w-full rounded-2xl border border-amber-500/20 bg-[#101733] py-3.5 pl-11 pr-4 text-sm text-amber-100 outline-none transition placeholder:text-amber-500/40 focus:border-amber-400/60 focus:bg-[#141d42]" />
            </div>
            {filteredDiscover.length === 0 ? <EmptyState message={search ? 'No users match your search.' : 'No other verified users yet.'} /> : (
              <div className="grid gap-3 sm:grid-cols-2">
                {filteredDiscover.map((user) => {
                  const status = user.friendship_status;
                  return <div key={user.user_id} className="friend-card group rounded-2xl border border-amber-500/20 bg-gradient-to-br from-[#101733] to-[#080d1e] p-4 shadow-xl transition duration-300 hover:-translate-y-0.5 hover:border-amber-400/40 sm:p-5">
                    <div className="flex min-w-0 items-center gap-3">
                      <button onClick={() => onOpenProfile(user.user_id)} className="shrink-0 rounded-full transition group-hover:ring-2 group-hover:ring-amber-400/40"><Avatar name={user.full_name} avatarUrl={user.avatar_url} size={11} /></button>
                      <button onClick={() => onOpenProfile(user.user_id)} className="min-w-0 flex-1 text-left">
                        <div className="flex flex-wrap items-center gap-1.5"><p className="truncate font-bold text-amber-100 transition group-hover:text-amber-300">{user.full_name}</p><BadgeRow badge={user.badge ?? null} isAdmin={user.is_admin ?? false} size="xs" /></div>
                        <p className="mt-1 truncate text-xs font-medium text-amber-400/60">@{user.username}</p>
                      </button>
                    </div>
                    <div className="mt-4 border-t border-amber-500/15 pt-3">
                      {status === 'none' && <ActionButton onClick={() => runAction(`send-${user.user_id}`, () => sendFriendRequest(user.user_id))} loading={actionLoading === `send-${user.user_id}`} icon={<UserPlus size={15} />} label="Add friend" />}
                      {status === 'pending_outgoing' && <StatusPill icon={<Check size={13} />} label="Request sent" />}
                      {status === 'pending_incoming' && <StatusPill icon={<UserPlus size={13} />} label="Wants to connect" warm />}
                      {status === 'accepted' && <ActionButton onClick={() => onStartChat(user.user_id)} icon={<MessageCircle size={15} />} label="Send message" />}
                      {status === 'declined_outgoing' && <ActionButton muted onClick={() => runAction(`send-${user.user_id}`, () => sendFriendRequest(user.user_id))} loading={actionLoading === `send-${user.user_id}`} icon={<UserPlus size={15} />} label="Request again" />}
                    </div>
                  </div>;
                })}
              </div>
            )}
          </>
        ) : tab === 'requests' ? (
          requests.length === 0 ? <EmptyState message="No friend requests right now." /> : <div className="space-y-3">{requests.map((req) => <div key={req.requester_id} className="friend-card flex flex-col gap-4 rounded-2xl border border-amber-500/20 bg-[#101733] p-4 transition hover:border-amber-400/40 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <PersonButton name={req.requester_name} username={req.requester_username} avatarUrl={req.requester_avatar_url} badge={req.requester_badge} isAdmin={req.requester_is_admin} onClick={() => onOpenProfile(req.requester_id)} />
            <div className="grid grid-cols-2 gap-2 sm:flex"><ActionButton success onClick={() => runAction(`accept-${req.requester_id}`, () => acceptFriendRequest(req.requester_id))} loading={actionLoading === `accept-${req.requester_id}`} icon={<Check size={15} />} label="Accept" /><ActionButton muted onClick={() => runAction(`decline-${req.requester_id}`, () => declineFriendRequest(req.requester_id))} loading={actionLoading === `decline-${req.requester_id}`} icon={<X size={15} />} label="Decline" /></div>
          </div>)}</div>
        ) : tab === 'friends' ? (
          friends.length === 0 ? <EmptyState message="You haven't added any friends yet." /> : <div className="grid gap-3 sm:grid-cols-2">{friends.map((friend) => <div key={friend.friend_id} className="friend-card rounded-2xl border border-amber-500/20 bg-[#101733] p-4 transition hover:border-amber-400/40 sm:p-5">
            <PersonButton name={friend.friend_name} username={friend.friend_username} avatarUrl={friend.friend_avatar_url} badge={friend.friend_badge} isAdmin={friend.friend_is_admin} onClick={() => onOpenProfile(friend.friend_id)} />
            <div className="mt-4 grid grid-cols-2 gap-2 border-t border-amber-500/15 pt-3"><ActionButton onClick={() => onStartChat(friend.friend_id)} icon={<MessageCircle size={15} />} label="Message" /><ActionButton danger muted onClick={() => runAction(`remove-${friend.friend_id}`, () => removeFriend(friend.friend_id))} loading={actionLoading === `remove-${friend.friend_id}`} icon={<UserMinus size={15} />} label="Unfriend" /></div>
          </div>)}</div>
        ) : (
          sentRequests.length === 0 ? <EmptyState message="You haven't sent any friend requests." /> : <div className="space-y-3">{sentRequests.map((req) => <div key={req.addressee_id} className="friend-card flex items-center justify-between gap-4 rounded-2xl border border-amber-500/20 bg-[#101733] p-4 transition hover:border-amber-400/40 sm:p-5">
            <PersonButton name={req.addressee_name} username={req.addressee_username} avatarUrl={req.addressee_avatar_url} badge={req.addressee_badge} isAdmin={req.addressee_is_admin} onClick={() => onOpenProfile(req.addressee_id)} />
            <StatusPill icon={<Check size={13} />} label="Pending" />
          </div>)}</div>
        )}
      </main>
      <style>{`
        @keyframes friends-float { 0%,100% { transform: translate3d(0,0,0) } 50% { transform: translate3d(0,18px,0) } }
        @keyframes friends-enter { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
        .friends-glow { animation: friends-float 13s ease-in-out infinite; }
        .friends-glow-delay { animation-delay: -6s; }
        .friend-card { animation: friends-enter .35s ease both; }
        @media (prefers-reduced-motion: reduce) { .friends-glow, .friend-card { animation: none !important; } }
      `}</style>
    </div>
  );
}

function TabButton({ active, onClick, icon, label, badge }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; badge?: number }) {
  return <button onClick={onClick} className={`relative flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-xs font-bold transition-all duration-200 sm:px-5 sm:text-sm ${active ? 'border-amber-400 text-amber-200' : 'border-transparent text-amber-500/60 hover:text-amber-200'}`}>
    <span className={active ? 'text-amber-300' : ''}>{icon}</span>{label}
    {badge !== undefined && badge > 0 && <span className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-extrabold ${active ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-500/10 text-amber-500/60'}`}>{badge}</span>}
    {active && <span className="absolute inset-x-3 -bottom-px h-px bg-gradient-to-r from-transparent via-amber-300 to-transparent" />}
  </button>;
}

function PersonButton({ name, username, avatarUrl, badge, isAdmin, onClick }: { name: string; username: string; avatarUrl: string | null; badge: any; isAdmin: boolean | null | undefined; onClick: () => void }) {
  return <button onClick={onClick} className="group flex min-w-0 items-center gap-3 text-left">
    <span className="shrink-0 rounded-full transition group-hover:ring-2 group-hover:ring-amber-400/40"><Avatar name={name} avatarUrl={avatarUrl} size={11} /></span>
    <span className="min-w-0"><span className="flex flex-wrap items-center gap-1.5"><span className="truncate font-bold text-amber-100 transition group-hover:text-amber-300">{name}</span><BadgeRow badge={badge ?? null} isAdmin={isAdmin ?? false} size="xs" /></span><span className="mt-1 block truncate text-xs font-medium text-amber-400/60">@{username}</span></span>
  </button>;
}

function ActionButton({ onClick, icon, label, loading = false, muted = false, success = false, danger = false }: { onClick: () => void; icon: React.ReactNode; label: string; loading?: boolean; muted?: boolean; success?: boolean; danger?: boolean }) {
  const style = success 
    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20' 
    : danger 
    ? 'border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20' 
    : muted 
    ? 'border-amber-500/20 bg-[#0c1126] text-amber-300/80 hover:border-amber-400/40 hover:bg-amber-500/10 hover:text-amber-200' 
    : 'border-amber-500/40 bg-gradient-to-r from-amber-400 to-amber-600 text-slate-950 font-bold hover:brightness-110 shadow-md';
  return <button onClick={onClick} disabled={loading} className={`inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold transition duration-200 disabled:cursor-wait disabled:opacity-50 ${style}`}>
    {loading ? <Loader2 size={14} className="animate-spin" /> : icon}{label}
  </button>;
}

function StatusPill({ icon, label, warm = false }: { icon: React.ReactNode; label: string; warm?: boolean }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${warm ? 'border-amber-500/30 bg-amber-500/10 text-amber-300' : 'border-amber-500/20 bg-[#0c1126] text-amber-400/60'}`}>{icon}{label}</span>;
}

function EmptyState({ message }: { message: string }) {
  return <div className="flex min-h-64 flex-col items-center justify-center rounded-3xl border border-dashed border-amber-500/20 bg-[#0c1126]/80 px-6 py-14 text-center">
    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl border border-amber-500/30 bg-gradient-to-br from-amber-400/10 to-amber-600/10 text-amber-300/80"><Users size={27} /></div>
    <p className="font-bold text-amber-100">Nothing here yet</p><p className="mt-1.5 max-w-xs text-xs font-medium leading-5 text-amber-500/60">{message}</p>
  </div>;
}