import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getFriends, getPublicProfile, getUserFriends, deleteOwnAccount } from '@/lib/friends';
import { getMyActiveNotes, deleteNote } from '@/lib/notes';
import { supabase } from '@/lib/supabase';
import Footer from '@/components/Footer';
import { Friend, MyNote, Post, PublicProfile } from '@/types';
import {
  ArrowLeft,
  ShieldCheck,
  Mail,
  Phone,
  Calendar,
  LogOut,
  Trash2,
  Users,
  Loader2,
  X,
  StickyNote,
  Clock,
  FileText,
  KeyRound,
  Camera,
  Music,
  Play,
  Pause,
  Search,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import Avatar from '@/components/Avatar';
import { BadgeRow } from '@/components/Badge';
import { useBackgroundMusic } from '@/context/MusicContext';

interface ProfilePageProps {
  viewedUserId?: string | null;
  onBack: () => void;
  onSignOut: () => void;
  onOpenProfile: (userId: string) => void;
  notificationBell?: React.ReactNode;
}

export default function ProfilePage({
  viewedUserId,
  onBack,
  onSignOut,
  onOpenProfile,
  notificationBell,
}: ProfilePageProps) {
  const { profile: ownProfile, refreshProfile } = useAuth();
  const isOwn = !viewedUserId || viewedUserId === ownProfile?.id;
  const profile = isOwn ? ownProfile : null;

  const [publicProfile, setPublicProfile] = useState<PublicProfile | null>(null);
  const [publicFriends, setPublicFriends] = useState<Friend[]>([]);
  const [publicPosts, setPublicPosts] = useState<Post[]>([]);
  const [publicNotes, setPublicNotes] = useState<MyNote[]>([]);
  const [loadingPublic, setLoadingPublic] = useState(false);

  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendSearch, setFriendSearch] = useState('');
  const [showAllFriends, setShowAllFriends] = useState(false);

  const [myNotes, setMyNotes] = useState<MyNote[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPwFields, setShowPwFields] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState('');

  const { tracks, currentTrack, isPlaying, selectTrack, togglePlay, hasMusic } = useBackgroundMusic();
  const [musicSearch, setMusicSearch] = useState('');

  // Load own profile data on mount
  useEffect(() => {
    let isMounted = true;

    if (isOwn) {
      getFriends()
        .then((data) => {
          if (isMounted) setFriends(data);
        })
        .catch(() => {});

      getMyActiveNotes()
        .then((data) => {
          if (isMounted) setMyNotes(data);
        })
        .catch(() => {});
    }

    return () => {
      isMounted = false;
    };
  }, [isOwn]);

  // Load target user profile when viewing another profile
  useEffect(() => {
    if (isOwn || !viewedUserId) {
      setPublicProfile(null);
      setLoadingPublic(false);
      return;
    }

    let isMounted = true;
    setLoadingPublic(true);

    Promise.all([
      getPublicProfile(viewedUserId),
      getUserFriends(viewedUserId),
      supabase
        .from('posts')
        .select('id, user_id, content_type, text_content, media_url, is_removed, created_at')
        .eq('user_id', viewedUserId)
        .eq('is_removed', false)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('notes')
        .select('id, content, expires_at, created_at')
        .eq('user_id', viewedUserId)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(20),
    ])
      .then(([prof, friendsList, postsRes, notesRes]) => {
        if (!isMounted) return;
        setPublicProfile(prof);
        setPublicFriends(friendsList);
        setPublicPosts(
          ((postsRes.data as any[]) || []).map((p) => ({
            ...p,
            author_name: prof?.full_name ?? 'Unknown',
            author_username: prof?.username ?? 'unknown',
          }))
        );
        setPublicNotes(
          ((notesRes.data as any[]) || []).map((n: any) => ({
            note_id: n.id,
            content: n.content,
            expires_at: n.expires_at,
            created_at: n.created_at,
          }))
        );
      })
      .catch(() => {
        if (isMounted) setPublicProfile(null);
      })
      .finally(() => {
        if (isMounted) setLoadingPublic(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOwn, viewedUserId]);

  // Filter friends list based on search query
  const friendsList = isOwn ? friends : publicFriends;
  const filteredFriends = useMemo(() => {
    if (!friendSearch.trim()) return friendsList;
    const query = friendSearch.toLowerCase();
    return friendsList.filter(
      (f) =>
        f.friend_name.toLowerCase().includes(query) ||
        f.friend_username.toLowerCase().includes(query)
    );
  }, [friendsList, friendSearch]);

  const visibleFriends = showAllFriends ? filteredFriends : filteredFriends.slice(0, 5);

  // Filter music tracks based on search query
  const filteredTracks = useMemo(() => {
    if (!musicSearch.trim()) return tracks;
    const query = musicSearch.toLowerCase();
    return tracks.filter((t) => t.title.toLowerCase().includes(query));
  }, [tracks, musicSearch]);

  if (isOwn && !profile) return null;

  if (!isOwn && loadingPublic) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#060913]">
        <Loader2 size={28} className="animate-spin text-amber-400" />
      </div>
    );
  }

  if (!isOwn && !publicProfile) {
    return (
      <div className="min-h-screen bg-[#060913] text-amber-100">
        <header className="sticky top-0 z-20 border-b border-amber-500/20 bg-[#0a0f24]/90 backdrop-blur-md">
          <div className="mx-auto flex max-w-2xl items-center gap-4 px-4 py-3">
            <button
              onClick={onBack}
              className="rounded-lg p-1.5 text-amber-400/80 transition hover:bg-amber-500/10 hover:text-amber-200"
            >
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-lg font-semibold text-amber-200">Profile</h1>
          </div>
        </header>
        <main className="mx-auto max-w-2xl px-4 py-16 text-center">
          <p className="text-amber-400/60">This profile is unavailable.</p>
        </main>
      </div>
    );
  }

  const view = isOwn ? profile! : null;
  const displayName = isOwn ? view!.full_name : publicProfile!.full_name;
  const displayUsername = isOwn ? view!.username : publicProfile!.username;
  const displayStatus = isOwn ? view!.verification_status : publicProfile!.verification_status;
  const joinedDate = isOwn ? view!.created_at : publicProfile!.created_at;
  const friendCount = isOwn ? friends.length : publicProfile!.friend_count;

  const statusColors: Record<string, string> = {
    verified: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
    pending: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
    rejected: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
    unverified: 'bg-slate-800/80 text-slate-400 border-slate-700',
  };

  const isRestricted =
    isOwn && !!(profile!.restricted_until && new Date(profile!.restricted_until) > new Date());

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !isOwn || !profile) return;
    if (!file.type.startsWith('image/')) {
      setAvatarError('Please choose an image file.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError('Image must be smaller than 5 MB.');
      return;
    }
    setUploadingAvatar(true);
    setAvatarError('');
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${profile.id}/avatar-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: urlData.publicUrl })
        .eq('id', profile.id);
      if (updateError) throw updateError;
      await refreshProfile?.();
    } catch {
      setAvatarError('Could not update profile picture. Please try again.');
    }
    setUploadingAvatar(false);
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteOwnAccount();
      await onSignOut();
    } catch {
      setDeleteError('Failed to delete account. Please try again.');
    }
    setDeleting(false);
  };

  const handleChangePassword = async () => {
    setPasswordError('');
    setPasswordMessage('');

    if (!currentPassword || !newPassword) {
      setPasswordError('Please fill in both password fields.');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    setChangingPassword(true);
    try {
      const verifyError = profile!.email
        ? (
            await supabase.auth.signInWithPassword({
              email: profile!.email,
              password: currentPassword,
            })
          ).error
        : (
            await supabase.auth.signInWithPassword({
              phone: profile!.phone ?? '',
              password: currentPassword,
            })
          ).error;

      if (verifyError) {
        setPasswordError('Current password is incorrect.');
        setChangingPassword(false);
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateError) {
        setPasswordError(updateError.message || 'Could not change password. Please try again.');
      } else {
        setPasswordMessage('Your password has been changed.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setShowPwFields(false);
      }
    } catch {
      setPasswordError('Something went wrong. Please try again.');
    }
    setChangingPassword(false);
  };

  const headerTitle = isOwn ? 'Profile' : `@${displayUsername}`;

  return (
    <div className="min-h-screen bg-[#060913] text-amber-50">
      {/* Regal Header */}
      <header className="sticky top-0 z-20 border-b border-amber-500/20 bg-[#0a0f24]/90 backdrop-blur-md shadow-lg shadow-black/40">
        <div className="mx-auto flex max-w-2xl items-center gap-4 px-4 py-3.5">
          <button
            onClick={onBack}
            className="rounded-lg p-1.5 text-amber-400/80 transition hover:bg-amber-500/10 hover:text-amber-200"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-lg font-bold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-amber-100 via-amber-300 to-amber-200">
            {headerTitle}
          </h1>
          {notificationBell && <div className="ml-auto">{notificationBell}</div>}
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8">
        {/* Navy & Gold Profile Card */}
        <div className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-b from-[#111836] via-[#0c1228] to-[#070b19] p-6 text-center shadow-[0_20px_50px_-20px_rgba(217,119,6,0.25)]">
          <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-56 w-56 rounded-full bg-amber-500/10 blur-3xl" />
          
          <div className="relative mx-auto mb-4 h-24 w-24">
            <Avatar
              name={displayName}
              avatarUrl={isOwn ? profile!.avatar_url : (publicProfile as any)?.avatar_url}
              size={24}
              className="shadow-2xl ring-2 ring-amber-400/50"
            />
            {isOwn && (
              <label
                className="absolute -bottom-1 -right-1 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-amber-500/40 bg-[#0f1530] text-amber-300 shadow-lg transition hover:border-amber-300 hover:bg-amber-500/20 hover:scale-105"
                aria-label="Change profile picture"
              >
                {uploadingAvatar ? <Loader2 size={16} className="animate-spin text-amber-400" /> : <Camera size={16} />}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarChange}
                  disabled={uploadingAvatar}
                />
              </label>
            )}
          </div>
          {avatarError && isOwn && <p className="mb-2 text-sm text-rose-400">{avatarError}</p>}
          
          <h2 className="text-2xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-100 via-amber-300 to-amber-200">
            {displayName}
          </h2>
          <p className="text-sm font-semibold text-amber-400/70">@{displayUsername}</p>

          {((isOwn ? profile!.badge : publicProfile!.badge) ||
            (isOwn ? profile!.is_admin : (publicProfile as any)?.is_admin)) && (
            <div className="mt-3 flex justify-center">
              <BadgeRow
                badge={isOwn ? profile!.badge : ((publicProfile as any)?.badge ?? null)}
                isAdmin={isOwn ? profile!.is_admin : ((publicProfile as any)?.is_admin ?? false)}
              />
            </div>
          )}

          <div
            className={`mt-4 inline-flex items-center gap-1.5 rounded-full border px-4 py-1 text-xs font-semibold tracking-wider uppercase ${
              statusColors[displayStatus] || statusColors.unverified
            }`}
          >
            <ShieldCheck size={14} />
            {displayStatus ? displayStatus.charAt(0).toUpperCase() + displayStatus.slice(1) : 'Unverified'}
          </div>

          <div className="mt-4.5 inline-flex items-center gap-2 text-xs font-bold text-amber-200/90 bg-amber-500/10 border border-amber-500/20 px-4 py-1.5 rounded-full shadow-inner">
            <Users size={14} className="text-amber-400" />
            {friendCount} {friendCount === 1 ? 'Friend' : 'Friends'}
          </div>
        </div>

        {/* Friends Section with Search and Show More/Less */}
        {friendsList.length > 0 && (
          <div className="mt-6 rounded-2xl border border-amber-500/20 bg-[#0c1126]/90 p-5 shadow-xl backdrop-blur-md">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-bold tracking-wide text-amber-200">
                <Users size={16} className="text-amber-400" />
                Friends ({friendsList.length})
              </h3>
            </div>

            {/* Friends Search */}
            <div className="relative mb-3">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-400/60" />
              <input
                type="text"
                value={friendSearch}
                onChange={(e) => setFriendSearch(e.target.value)}
                placeholder="Search friends..."
                className="w-full rounded-xl border border-amber-500/20 bg-[#121938] pl-9 pr-4 py-2 text-sm text-amber-100 placeholder-amber-400/30 transition focus:border-amber-400/60 focus:bg-[#161f47] focus:outline-none"
              />
            </div>

            {filteredFriends.length === 0 ? (
              <p className="rounded-xl border border-dashed border-amber-500/20 py-4 text-center text-xs text-amber-400/50">
                No friends found matching "{friendSearch}"
              </p>
            ) : (
              <div className="space-y-2">
                {visibleFriends.map((f) => (
                  <button
                    key={f.friend_id}
                    onClick={() => onOpenProfile(f.friend_id)}
                    className="flex w-full items-center gap-3 rounded-xl border border-amber-500/15 bg-[#101733]/70 p-3 text-left transition duration-200 hover:border-amber-400/40 hover:bg-[#162046]"
                  >
                    <Avatar name={f.friend_name} avatarUrl={(f as any).friend_avatar_url} size={9} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-amber-100">{f.friend_name}</p>
                      <p className="truncate text-xs text-amber-400/60">@{f.friend_username}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Show More / Show Less Toggle */}
            {filteredFriends.length > 5 && (
              <button
                onClick={() => setShowAllFriends(!showAllFriends)}
                className="mt-3.5 flex w-full items-center justify-center gap-1.5 rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-amber-500/20 to-amber-500/10 py-2.5 text-xs font-bold text-amber-300 transition duration-200 hover:border-amber-400 hover:text-amber-100 active:scale-[0.99]"
              >
                {showAllFriends ? (
                  <>
                    Show Less <ChevronUp size={15} />
                  </>
                ) : (
                  <>
                    Show More ({filteredFriends.length - 5} remaining) <ChevronDown size={15} />
                  </>
                )}
              </button>
            )}
          </div>
        )}

        {/* Music Section */}
        {isOwn && (
          <div className="mt-6 rounded-2xl border border-amber-500/20 bg-[#0c1126]/90 p-5 shadow-xl backdrop-blur-md">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold tracking-wide text-amber-200">
              <Music size={16} className="text-amber-400" />
              Background Music
            </h3>
            {!hasMusic ? (
              <div className="rounded-xl border border-amber-500/15 bg-[#101733] px-4 py-3">
                <p className="text-xs text-amber-400/50">No music tracks available.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {currentTrack && (
                  <div className="flex items-center gap-3 rounded-xl border border-amber-500/40 bg-gradient-to-r from-amber-500/20 to-amber-600/10 px-4 py-3 shadow-md">
                    <button
                      onClick={togglePlay}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 via-amber-400 to-amber-600 text-slate-950 shadow-md transition hover:scale-105 active:scale-95"
                      aria-label={isPlaying ? 'Pause' : 'Play'}
                    >
                      {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-amber-100">{currentTrack.title}</p>
                      <p className="text-xs font-medium text-amber-300/80">{isPlaying ? 'Now Playing' : 'Paused'}</p>
                    </div>
                    <button
                      onClick={() => selectTrack(null)}
                      className="rounded-lg p-1.5 text-amber-400/60 transition hover:bg-amber-500/20 hover:text-amber-200"
                      aria-label="Stop"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}

                <div className="rounded-xl border border-amber-500/20 bg-[#101733] p-3">
                  {/* Track Search */}
                  <div className="relative mb-2.5">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-400/50" />
                    <input
                      type="text"
                      value={musicSearch}
                      onChange={(e) => setMusicSearch(e.target.value)}
                      placeholder="Search music tracks..."
                      className="w-full rounded-lg border border-amber-500/20 bg-[#141d42] pl-8 pr-3 py-1.5 text-xs text-amber-100 placeholder-amber-400/30 focus:border-amber-400/60 focus:outline-none"
                    />
                  </div>

                  <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
                    {filteredTracks.length === 0 ? (
                      <p className="px-2 py-3 text-center text-xs text-amber-400/50">
                        No songs found matching "{musicSearch}"
                      </p>
                    ) : (
                      filteredTracks.map((track) => (
                        <button
                          key={track.id}
                          onClick={() => (currentTrack?.id === track.id ? togglePlay() : selectTrack(track.id))}
                          className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition ${
                            currentTrack?.id === track.id
                              ? 'bg-amber-500/20 text-amber-200 border border-amber-500/30'
                              : 'hover:bg-amber-500/10 text-amber-100/80'
                          }`}
                        >
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-400">
                            {currentTrack?.id === track.id && isPlaying ? (
                              <Pause size={13} className="text-amber-300" />
                            ) : (
                              <Play size={13} className="ml-0.5" />
                            )}
                          </span>
                          <span
                            className={`truncate text-xs font-medium ${
                              currentTrack?.id === track.id ? 'text-amber-300 font-bold' : ''
                            }`}
                          >
                            {track.title}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Notes Section */}
        <div className="mt-6 rounded-2xl border border-amber-500/20 bg-[#0c1126]/90 p-5 shadow-xl backdrop-blur-md">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold tracking-wide text-amber-200">
            <StickyNote size={16} className="text-amber-400" />
            {isOwn ? 'My Notes · visible for 24h' : 'Notes · visible for 24h'}
          </h3>
          {(isOwn ? myNotes : publicNotes).length === 0 ? (
            <p className="rounded-xl border border-dashed border-amber-500/20 py-6 text-center text-xs text-amber-400/50">
              {isOwn ? 'You have no active notes. Post one from the feed!' : 'No active notes.'}
            </p>
          ) : (
            <div className="space-y-3">
              {(isOwn ? myNotes : publicNotes).map((note) => {
                const hoursLeft = Math.max(
                  0,
                  Math.ceil((new Date(note.expires_at).getTime() - Date.now()) / 3600000)
                );
                return (
                  <div
                    key={note.note_id}
                    className="group flex items-start justify-between rounded-xl border border-amber-500/20 bg-[#101733] p-4 transition hover:border-amber-400/50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-relaxed text-amber-100">{note.content}</p>
                      <p className="mt-2 flex items-center gap-1 text-[11px] font-medium text-amber-400/60">
                        <Clock size={11} />
                        Disappears in {hoursLeft}h
                      </p>
                    </div>
                    {isOwn && (
                      <button
                        onClick={async () => {
                          await deleteNote(note.note_id);
                          setMyNotes((prev) => prev.filter((n) => n.note_id !== note.note_id));
                        }}
                        className="ml-3 rounded-lg p-1.5 text-amber-400/40 transition hover:bg-rose-500/20 hover:text-rose-400"
                        aria-label="Delete note"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Public Posts Section */}
        {!isOwn && (
          <div className="mt-6 rounded-2xl border border-amber-500/20 bg-[#0c1126]/90 p-5 shadow-xl backdrop-blur-md">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold tracking-wide text-amber-200">
              <FileText size={16} className="text-amber-400" />
              Posts
            </h3>
            {publicPosts.length === 0 ? (
              <p className="rounded-xl border border-dashed border-amber-500/20 py-6 text-center text-xs text-amber-400/50">
                No posts yet.
              </p>
            ) : (
              <div className="space-y-3">
                {publicPosts.map((post) => (
                  <div key={post.id} className="rounded-xl border border-amber-500/20 bg-[#101733] p-4">
                    <p className="mb-1 text-[11px] text-amber-400/50">
                      {new Date(post.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                    {post.text_content && (
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-amber-100">
                        {post.text_content}
                      </p>
                    )}
                    {post.media_url && post.content_type === 'photo' && (
                      <img src={post.media_url} alt="Post" className="mt-2.5 max-h-72 w-full rounded-lg object-cover" />
                    )}
                    {post.media_url && post.content_type === 'video' && (
                      <video src={post.media_url} controls className="mt-2.5 max-h-72 w-full rounded-lg" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Profile Contact Info with Cognac Bordering */}
        {isOwn && (
          <div className="mt-6 space-y-2.5">
            {profile!.email && (
              <div className="flex items-center gap-3 rounded-xl border border-amber-500/20 bg-[#0a0e20] px-4 py-3">
                <Mail size={18} className="text-amber-400/60" />
                <div>
                  <p className="text-[11px] font-medium text-amber-400/60">Email</p>
                  <p className="text-sm font-medium text-amber-100">{profile!.email}</p>
                </div>
              </div>
            )}
            {profile!.phone && (
              <div className="flex items-center gap-3 rounded-xl border border-amber-500/20 bg-[#0a0e20] px-4 py-3">
                <Phone size={18} className="text-amber-400/60" />
                <div>
                  <p className="text-[11px] font-medium text-amber-400/60">Phone</p>
                  <p className="text-sm font-medium text-amber-100">{profile!.phone}</p>
                </div>
              </div>
            )}
            <div className="flex items-center gap-3 rounded-xl border border-amber-500/20 bg-[#0a0e20] px-4 py-3">
              <Calendar size={18} className="text-amber-400/60" />
              <div>
                <p className="text-[11px] font-medium text-amber-400/60">Joined</p>
                <p className="text-sm font-medium text-amber-100">
                  {new Date(joinedDate).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>
            </div>
          </div>
        )}

        {!isOwn && (
          <div className="mt-6">
            <div className="flex items-center gap-3 rounded-xl border border-amber-500/20 bg-[#0a0e20] px-4 py-3">
              <Calendar size={18} className="text-amber-400/60" />
              <div>
                <p className="text-[11px] font-medium text-amber-400/60">Joined</p>
                <p className="text-sm font-medium text-amber-100">
                  {new Date(joinedDate).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Warnings */}
        {isOwn && profile!.is_blocked && (
          <div className="mt-6 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-4 text-center">
            <p className="font-bold text-rose-300">Account Blocked</p>
            <p className="mt-1 text-xs text-rose-200/70">
              Your account has been blocked by an administrator. Please contact support.
            </p>
          </div>
        )}

        {isOwn && isRestricted && (
          <div className="mt-6 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-4 text-center">
            <p className="font-bold text-amber-300">Account Restricted</p>
            <p className="mt-1 text-xs text-amber-200/70">
              You are restricted until {new Date(profile!.restricted_until!).toLocaleDateString()}.
            </p>
          </div>
        )}

        {/* Change Password */}
        {isOwn && (
          <div className="mt-6 rounded-2xl border border-amber-500/20 bg-[#0c1126]/90 p-5 shadow-xl backdrop-blur-md">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold tracking-wide text-amber-200">
              <KeyRound size={16} className="text-amber-400" />
              Security
            </h3>
            {!showPwFields ? (
              <button
                onClick={() => {
                  setShowPwFields(true);
                  setPasswordMessage('');
                  setPasswordError('');
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-amber-500/15 to-amber-500/10 py-3 text-sm font-semibold text-amber-200 transition hover:border-amber-400 hover:bg-amber-500/20 active:scale-[0.99]"
              >
                <KeyRound size={16} />
                Change Password
              </button>
            ) : (
              <div className="space-y-3 rounded-xl border border-amber-500/20 bg-[#101733] p-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-amber-200/80">Current Password</label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full rounded-lg border border-amber-500/20 bg-[#141d42] px-3 py-2 text-sm text-amber-100 focus:border-amber-400 focus:outline-none"
                    placeholder="Enter current password"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-amber-200/80">New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full rounded-lg border border-amber-500/20 bg-[#141d42] px-3 py-2 text-sm text-amber-100 focus:border-amber-400 focus:outline-none"
                    placeholder="At least 6 characters"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-amber-200/80">Confirm New Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full rounded-lg border border-amber-500/20 bg-[#141d42] px-3 py-2 text-sm text-amber-100 focus:border-amber-400 focus:outline-none"
                    placeholder="Repeat new password"
                  />
                </div>

                {passwordError && (
                  <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                    {passwordError}
                  </div>
                )}
                {passwordMessage && (
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                    {passwordMessage}
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => {
                      setShowPwFields(false);
                      setCurrentPassword('');
                      setNewPassword('');
                      setConfirmPassword('');
                      setPasswordError('');
                      setPasswordMessage('');
                    }}
                    className="flex-1 rounded-lg border border-amber-500/20 py-2 text-xs font-semibold text-amber-300/70 transition hover:bg-amber-500/10 hover:text-amber-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleChangePassword}
                    disabled={changingPassword}
                    className="flex-1 rounded-lg bg-gradient-to-r from-amber-300 via-amber-400 to-amber-600 py-2 text-xs font-bold text-slate-950 shadow-md transition hover:brightness-110 active:scale-[0.98]"
                  >
                    {changingPassword ? <Loader2 size={15} className="mx-auto animate-spin" /> : 'Save Password'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Sign Out */}
        {isOwn && (
          <button
            onClick={onSignOut}
            className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-[#0a0e20] py-3 text-sm font-semibold text-amber-200 transition hover:border-amber-400 hover:bg-amber-500/10 active:scale-[0.99]"
          >
            <LogOut size={18} />
            Sign Out
          </button>
        )}

        {/* Delete Account */}
        {isOwn &&
          (!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-rose-500/20 bg-transparent py-3 text-sm font-semibold text-rose-400/80 transition hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-300 active:scale-[0.99]"
            >
              <Trash2 size={18} />
              Delete Account
            </button>
          ) : (
            <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/5 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold text-rose-300">Delete your account?</p>
                  <p className="mt-1 text-xs text-amber-200/60">
                    This will permanently remove your profile, posts, and friends. This cannot be undone.
                  </p>
                </div>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="rounded-lg p-1 text-amber-400/60 transition hover:text-amber-200"
                >
                  <X size={18} />
                </button>
              </div>
              {deleteError && <p className="mt-2 text-xs text-rose-400">{deleteError}</p>}
              <button
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-rose-600 py-2.5 text-xs font-bold text-white shadow-md transition hover:bg-rose-700 active:scale-[0.98] disabled:opacity-50"
              >
                {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                Yes, delete my account
              </button>
            </div>
          ))}
      </main>
      <Footer />
    </div>
  );
}