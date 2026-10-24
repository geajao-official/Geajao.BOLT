import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { filterBadWords } from '@/lib/badWords';
import { Post, ContentType, Profile, Note, ReactionType, PostComment, BadgeType } from '@/types';
import { sendFriendRequest } from '@/lib/friends';
import { createNote, getActiveNotes, deleteNote } from '@/lib/notes';
import { getReactionSummary, setMyReaction, getComments, addComment, deleteComment } from '@/lib/postInteractions';
import Avatar from '@/components/Avatar';
import { BadgeRow } from '@/components/Badge';
import Logo from '@/components/Logo';
import Footer from '@/components/Footer';
import {
  Image as ImageIcon,
  Video as VideoIcon,
  Send,
  Loader2,
  Trash2,
  X,
  UserPlus,
  Users,
  Check,
  MessageCircle,
  StickyNote,
  Plus,
  Clock,
  SendHorizontal,
  Globe,
  Lock,
} from 'lucide-react';

interface FeedPageProps {
  onSignOut: () => void;
  onViewProfile: () => void;
  onViewUserProfile: (userId: string) => void;
  onViewFriends: () => void;
  onViewChat: () => void;
  notificationBell?: React.ReactNode;
}

const HEADER_BTN =
  'relative flex h-10 w-10 shrink-0 touch-manipulation items-center justify-center rounded-full border border-amber-500/30 bg-[#0d142d] text-amber-300 transition hover:bg-[#152046] hover:border-amber-400 active:scale-95 shadow-md';

export default function FeedPage({
  onSignOut,
  onViewProfile,
  onViewUserProfile,
  onViewFriends,
  onViewChat,
  notificationBell,
}: FeedPageProps) {
  const { profile } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [myBadge, setMyBadge] = useState<BadgeType | null>(null);
  const [circleOnly, setCircleOnly] = useState(false);
  const [text, setText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [mediaType, setMediaType] = useState<ContentType>('text');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');
  const [friendRequestCount, setFriendRequestCount] = useState(0);
  const [suggestedUsers, setSuggestedUsers] = useState<Profile[]>([]);
  const [friendStatuses, setFriendStatuses] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Note[]>([]);
  const [noteText, setNoteText] = useState('');
  const [postingNote, setPostingNote] = useState(false);
  const [showNoteInput, setShowNoteInput] = useState(false);

  const fetchPosts = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('get_feed_posts', {
        limit_count: 50,
        badge_filter: circleOnly ? 'badge_holders' : null,
      });

      if (error) {
        console.error('Error fetching posts:', error);
        setPosts([]);
        setLoading(false);
        return;
      }

      const rows = (data || []) as Array<{
        id: string;
        user_id: string;
        content_type: ContentType;
        text_content: string | null;
        media_url: string | null;
        is_removed: boolean;
        created_at: string;
        author_name: string;
        author_username: string;
        author_avatar_url: string | null;
        author_badge: BadgeType | null;
        author_is_admin: boolean | null;
        audience: string;
      }>;

      const { data: mentionedIds } = await supabase.rpc('get_mentioned_post_ids');
      const mentionSet = new Set(((mentionedIds as string[]) || []));

      const formatted: Post[] = rows.map((p) => ({
        id: p.id,
        user_id: p.user_id,
        content_type: p.content_type as ContentType,
        text_content: p.text_content,
        media_url: p.media_url,
        is_removed: p.is_removed,
        created_at: p.created_at,
        author_name: p.author_name ?? 'Unknown',
        author_username: p.author_username ?? 'unknown',
        author_avatar_url: p.author_avatar_url ?? null,
        author_badge: p.author_badge ?? null,
        author_is_admin: p.author_is_admin ?? false,
        mentions_me: mentionSet.has(p.id),
      }));

      formatted.sort((a, b) => {
        if (a.mentions_me !== b.mentions_me) return a.mentions_me ? -1 : 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      setPosts(formatted);
    } catch (err) {
      console.error('Unexpected post fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [circleOnly]);

  const fetchFriendRequestCount = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_friend_requests');
    if (!error && data) {
      setFriendRequestCount(data.length);
    }
  }, []);

  const fetchSuggestedUsers = useCallback(async () => {
    if (!profile?.id) return;
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('id, username, full_name, email, phone, verification_status, is_blocked, restricted_until, created_at, updated_at, id_card_url, avatar_url')
      .eq('verification_status', 'verified')
      .neq('id', profile.id)
      .limit(5);

    if (profilesError || !profilesData) return;

    const users = profilesData as Profile[];
    setSuggestedUsers(users);

    const statuses: Record<string, string> = {};
    for (const user of users) {
      const { data: status } = await supabase.rpc('get_friendship_status', {
        p_other_user_id: user.id,
      });
      statuses[user.id] = (status as string) || 'none';
    }
    setFriendStatuses(statuses);
  }, [profile?.id]);

  const fetchNotes = useCallback(async () => {
    try {
      const data = await getActiveNotes();
      setNotes(data);
    } catch (err) {
      console.error('Failed to fetch notes:', err);
    }
  }, []);

  useEffect(() => {
    fetchPosts();
    fetchFriendRequestCount();
    fetchSuggestedUsers();
    fetchNotes();

    supabase.rpc('cleanup_expired_notes').then(() => fetchNotes());

    supabase.rpc('get_my_badge').then(({ data }) => {
      setMyBadge((data as BadgeType | null) ?? null);
    });
  }, [fetchPosts, fetchFriendRequestCount, fetchSuggestedUsers, fetchNotes]);

  useEffect(() => {
    const channel = supabase
      .channel('posts-changes-feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => {
        fetchPosts();
      })
      .subscribe();

    const notesChannel = supabase
      .channel('notes-changes-feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notes' }, () => {
        fetchNotes();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(notesChannel);
    };
  }, [fetchPosts, fetchNotes]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: ContentType) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setMediaType(type);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const clearMedia = () => {
    setSelectedFile(null);
    setPreviewUrl('');
    setMediaType('text');
  };

  const handlePost = async () => {
    if (!text.trim() && !selectedFile) return;
    setError('');
    setPosting(true);

    try {
      let mediaUrl: string | null = null;
      let contentType: ContentType = 'text';

      if (selectedFile) {
        contentType = mediaType;
        const fileExt = selectedFile.name.split('.').pop();
        const fileName = `${profile!.id}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('post-media')
          .upload(fileName, selectedFile);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('post-media')
          .getPublicUrl(fileName);

        mediaUrl = urlData.publicUrl;
      }

      const { error: insertError, data: newPost } = await supabase.from('posts').insert({
        user_id: profile!.id,
        content_type: contentType,
        text_content: text.trim() || null,
        media_url: mediaUrl,
        ...(circleOnly && myBadge ? { audience: 'badge' } : {}),
      })
      .select('id')
      .maybeSingle();

      if (insertError) throw insertError;

      const usernames = Array.from(text.trim().matchAll(/@([\w.]+)/g)).map((m) => m[1]);
      if (newPost?.id && usernames.length > 0) {
        await supabase.rpc('add_post_mentions', {
          p_post_id: newPost.id,
          p_usernames: usernames,
        });
      }

      setText('');
      clearMedia();
      await fetchPosts();
    } catch {
      setError('Failed to create post. Please try again.');
    }
    setPosting(false);
  };

  const handleDeletePost = async (postId: string) => {
    const { error } = await supabase.from('posts').delete().eq('id', postId);
    if (!error) {
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    }
  };

  const handleSendRequest = async (userId: string) => {
    try {
      await sendFriendRequest(userId);
      setFriendStatuses((prev) => ({ ...prev, [userId]: 'pending_outgoing' }));
    } catch {
      // ignore
    }
  };

  const handlePostNote = async () => {
    if (!noteText.trim()) return;
    setPostingNote(true);
    try {
      await createNote(filterBadWords(noteText.trim()));
      setNoteText('');
      setShowNoteInput(false);
      await fetchNotes();
    } catch (err) {
      console.error('Failed to post note:', err);
    }
    setPostingNote(false);
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      await deleteNote(noteId);
      await fetchNotes();
    } catch (err) {
      console.error('Failed to delete note:', err);
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="feed-future relative min-h-[100dvh] overflow-x-clip bg-[#060913] text-amber-50">
      <div aria-hidden="true" className="feed-ambient pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="feed-orb feed-orb-one" />
        <div className="feed-orb feed-orb-two" />
        <div className="feed-grid" />
      </div>

      {/* Header */}
      <header className="feed-header sticky top-0 z-20 border-b border-amber-500/20 bg-[#0a0f24]/90 pt-[env(safe-area-inset-top)] backdrop-blur-2xl shadow-lg">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-2.5 sm:px-6 sm:py-4">
          <h1 className="shrink-0 text-xl font-bold tracking-tight text-white">
            <Logo className="h-10 w-10 sm:h-16 sm:w-16" />
          </h1>
          <div className="flex items-center gap-1.5 sm:gap-3">
            <button onClick={onViewFriends} className={HEADER_BTN} aria-label="Friends">
              <Users size={18} className="text-amber-300" />
              {friendRequestCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-r from-amber-400 to-amber-600 text-[10px] font-bold text-slate-950 shadow-md">
                  {friendRequestCount}
                </span>
              )}
            </button>
            <button onClick={onViewChat} className={HEADER_BTN} aria-label="Messages">
              <MessageCircle size={18} className="text-amber-300" />
            </button>
            {notificationBell}
            <button onClick={onViewProfile} className={HEADER_BTN} aria-label="My profile">
              <Avatar name={profile?.full_name ?? 'U'} avatarUrl={profile?.avatar_url} size={7} />
            </button>
          </div>
        </div>
      </header>

      <main className="feed-main relative z-[1] mx-auto max-w-6xl px-3 py-5 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-8">
        {/* Notes strip */}
        <div className="feed-panel mb-5 rounded-3xl border border-amber-500/20 bg-[#0c1126]/90 p-4 shadow-[0_20px_50px_-20px_rgba(217,119,6,0.25)] backdrop-blur-xl sm:mb-7 sm:p-5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="flex min-w-0 items-center gap-1.5 text-sm font-bold text-amber-200">
              <StickyNote size={15} className="shrink-0 text-amber-400" />
              <span className="truncate">Notes · disappear in 24h</span>
            </h2>
            <button
              onClick={() => setShowNoteInput(!showNoteInput)}
              className="flex shrink-0 touch-manipulation items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-300 transition hover:bg-amber-500/20 active:scale-95"
            >
              <Plus size={14} />
              Note
            </button>
          </div>

          {showNoteInput && (
            <div className="mb-3 rounded-2xl border border-amber-500/30 bg-[#070b19] p-4 shadow-xl">
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="What's on your mind? This note disappears in 24 hours..."
                rows={2}
                maxLength={500}
                autoFocus
                className="w-full resize-none rounded-lg bg-[#101733] px-3 py-2.5 text-base text-amber-100 placeholder-amber-400/40 transition focus:border-amber-400 focus:outline-none sm:text-sm"
              />
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-amber-400/50">{noteText.length}/500</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowNoteInput(false); setNoteText(''); }}
                    className="touch-manipulation rounded-lg px-3 py-2 text-xs text-amber-400/60 transition hover:text-amber-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handlePostNote}
                    disabled={postingNote || !noteText.trim()}
                    className="btn-primary min-h-10 text-xs font-bold"
                  >
                    {postingNote ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    Post Note
                  </button>
                </div>
              </div>
            </div>
          )}

          {notes.length > 0 ? (
            <div className="-mx-3 flex snap-x gap-3 overflow-x-auto overscroll-x-contain px-3 pb-2 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
              {notes.map((note) => {
                const hoursLeft = Math.max(0, Math.ceil((new Date(note.expires_at).getTime() - Date.now()) / 3600000));
                const isOwn = note.user_id === profile?.id;
                return (
                  <div
                    key={note.note_id}
                    className="feed-note group relative w-48 shrink-0 snap-start rounded-2xl border border-amber-500/25 bg-gradient-to-br from-[#101733] via-[#0d132a] to-[#080d1e] p-4 shadow-lg transition duration-300 hover:-translate-y-1 hover:border-amber-400/50 sm:w-52"
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <button
                        onClick={() => !isOwn && onViewUserProfile(note.user_id)}
                        className="shrink-0 transition hover:opacity-80"
                        aria-label={`View ${note.author_name}'s profile`}
                      >
                        <Avatar name={note.author_name} avatarUrl={note.author_avatar_url} size={6} />
                      </button>
                      <button
                        onClick={() => !isOwn && onViewUserProfile(note.user_id)}
                        className="min-w-0 truncate text-xs font-semibold text-amber-200 transition hover:text-amber-400"
                      >
                        {note.author_name}
                      </button>
                    </div>
                    <p className="line-clamp-4 break-words text-sm leading-snug text-amber-100">{note.content}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="flex items-center gap-1 text-[10px] text-amber-400/60">
                        <Clock size={10} />
                        {hoursLeft}h left
                      </span>
                      {isOwn && (
                        <button
                          onClick={() => handleDeleteNote(note.note_id)}
                          className="-m-1 touch-manipulation rounded p-2 text-amber-400/40 transition hover:text-rose-400 sm:opacity-0 sm:group-hover:opacity-100"
                          aria-label="Delete note"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-amber-500/20 py-4 text-center text-xs text-amber-400/50">
              No notes yet — share a fleeting thought!
            </p>
          )}
        </div>

        {/* Post composer */}
        <div className="feed-panel mb-5 rounded-3xl border border-amber-500/20 bg-[#0c1126]/90 p-4 shadow-[0_20px_50px_-20px_rgba(217,119,6,0.25)] backdrop-blur-xl sm:mb-7 sm:p-6">
          <div className="flex gap-3">
            <div className="hidden shrink-0 sm:block">
              <Avatar name={profile?.full_name ?? 'U'} avatarUrl={profile?.avatar_url} size={10} />
            </div>
            <div className="min-w-0 flex-1">
              {myBadge && (
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setCircleOnly(false)}
                    className={`flex touch-manipulation items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      !circleOnly
                        ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                        : 'border-amber-500/20 text-amber-400/60 hover:text-amber-200'
                    }`}
                  >
                    <Globe size={12} />
                    Everyone
                  </button>
                  <button
                    onClick={() => setCircleOnly(true)}
                    className={`flex touch-manipulation items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      circleOnly
                        ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                        : 'border-amber-500/20 text-amber-400/60 hover:text-amber-200'
                    }`}
                  >
                    <Lock size={12} />
                    {myBadge === 'cadet' ? 'Cadet circle' : 'Ex-Cadet circle'}
                  </button>
                </div>
              )}
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Share something with the community..."
                rows={3}
                className="w-full resize-none rounded-xl bg-[#101733] px-3 py-3 text-base text-amber-100 placeholder-amber-400/40 transition focus:border-amber-400/60 focus:outline-none sm:px-4"
              />

              {previewUrl && (
                <div className="relative mt-3 overflow-hidden rounded-lg">
                  {mediaType === 'photo' ? (
                    <img src={previewUrl} alt="Preview" className="max-h-72 w-full object-cover sm:max-h-80" />
                  ) : (
                    <video src={previewUrl} controls playsInline className="max-h-72 w-full sm:max-h-80" />
                  )}
                  <button
                    onClick={clearMedia}
                    className="absolute right-2 top-2 touch-manipulation rounded-full bg-black/60 p-2 text-white transition hover:bg-black/80"
                    aria-label="Remove media"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}

              {error && (
                <div className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
                  {error}
                </div>
              )}

              <div className="mt-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  <label
                    className="flex h-11 w-11 cursor-pointer touch-manipulation items-center justify-center rounded-lg text-amber-400/60 transition hover:bg-amber-500/10 hover:text-amber-300 active:bg-amber-500/20"
                    aria-label="Add photo"
                  >
                    <ImageIcon size={22} />
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleFileSelect(e, 'photo')}
                    />
                  </label>
                  <label
                    className="flex h-11 w-11 cursor-pointer touch-manipulation items-center justify-center rounded-lg text-amber-400/60 transition hover:bg-amber-500/10 hover:text-amber-300 active:bg-amber-500/20"
                    aria-label="Add video"
                  >
                    <VideoIcon size={22} />
                    <input
                      type="file"
                      accept="video/*"
                      className="hidden"
                      onChange={(e) => handleFileSelect(e, 'video')}
                    />
                  </label>
                </div>
                <button
                  onClick={handlePost}
                  disabled={posting || (!text.trim() && !selectedFile)}
                  className="btn-primary min-h-11 px-6 font-bold"
                >
                  {posting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  Post
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Suggested friends */}
        {suggestedUsers.length > 0 && (
          <div className="feed-panel mb-5 rounded-3xl border border-amber-500/20 bg-[#0c1126]/90 p-4 shadow-xl backdrop-blur-xl sm:mb-7 sm:p-6">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold tracking-wide text-amber-200">
              <UserPlus size={16} className="text-amber-400" />
              People You May Know
            </h2>
            <div className="space-y-3">
              {suggestedUsers.map((user) => {
                const status = friendStatuses[user.id] || 'none';
                return (
                  <div key={user.id} className="feed-person flex items-center justify-between gap-3 rounded-2xl border border-amber-500/15 bg-[#101733]/80 p-3 transition hover:border-amber-400/40 hover:bg-[#162046]">
                    <button
                      onClick={() => onViewUserProfile(user.id)}
                      className="flex min-w-0 items-center gap-3 text-left transition hover:opacity-80"
                    >
                      <div className="shrink-0">
                        <Avatar name={user.full_name} avatarUrl={user.avatar_url} size={9} />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-amber-100">{user.full_name}</p>
                        <p className="truncate text-xs text-amber-400/60">@{user.username}</p>
                      </div>
                    </button>
                    {status === 'none' && (
                      <button
                        onClick={() => handleSendRequest(user.id)}
                        className="shrink-0 touch-manipulation whitespace-nowrap rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-300 transition hover:bg-amber-500/20 active:scale-95"
                      >
                        Add Friend
                      </button>
                    )}
                    {status === 'pending_outgoing' && (
                      <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-amber-400/60">
                        <Check size={12} />
                        Requested
                      </span>
                    )}
                    {status === 'accepted' && (
                      <span className="shrink-0 text-xs font-medium text-amber-400/60">Friends</span>
                    )}
                    {status === 'pending_incoming' && (
                      <span className="shrink-0 text-xs font-semibold text-amber-300">Wants to connect</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Feed Posts */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 size={32} className="animate-spin text-amber-400" />
          </div>
        ) : posts.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-amber-400/50">No posts yet. Be the first to share something!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <div key={post.id} className="relative">
                {post.mentions_me && (
                  <span className="absolute -top-2 left-4 z-10 rounded-full bg-gradient-to-r from-amber-400 to-amber-600 px-2 py-0.5 text-[10px] font-bold text-slate-950 shadow-md">
                    Mentioned you
                  </span>
                )}
                <PostCard
                  key={post.id}
                  post={post}
                  isOwn={post.user_id === profile?.id}
                  currentUserId={profile?.id ?? ''}
                  onDelete={() => handleDeletePost(post.id)}
                  formatTime={formatTime}
                  onOpenProfile={onViewUserProfile}
                />
              </div>
            ))}
          </div>
        )}
      </main>
      <div className="relative z-[1]"><Footer /></div>
      <style>{`
        .feed-future { isolation: isolate; background-color:#060913; }
        .feed-ambient {
          background:
            radial-gradient(ellipse at 50% 20%, rgba(217, 119, 6, .18), transparent 50%),
            radial-gradient(ellipse at 8% 55%, rgba(10, 15, 36, .80), transparent 45%),
            linear-gradient(180deg, #060913 0%, #0c1126 50%, #060913 100%);
        }
        .feed-grid { position:absolute; inset:0; opacity:.08; background-image:linear-gradient(rgba(245,158,11,.15) 1px,transparent 1px),linear-gradient(90deg,rgba(245,158,11,.15) 1px,transparent 1px); background-size:44px 44px; mask-image:linear-gradient(to bottom,black,transparent 80%); }
        .feed-orb { position:absolute; width:min(46vw,580px); aspect-ratio:1; border-radius:9999px; filter:blur(110px); opacity:.20; animation:feed-float 15s ease-in-out infinite alternate; }
        .feed-orb-one { top:5%; left:-17%; background:#d97706; }
        .feed-orb-two { top:28%; right:-17%; background:#92400e; animation-delay:-7s; }
        .feed-header { background:rgba(10,15,36,.92) !important; border-color:rgba(245,158,11,.20) !important; box-shadow:0 12px 50px -25px rgba(217,119,6,.35); }
        .feed-panel { background:linear-gradient(145deg,rgba(16,23,51,.95),rgba(10,15,36,.92)) !important; border-color:rgba(245,158,11,.22) !important; box-shadow:0 20px 60px -30px rgba(217,119,6,.28); }
        .feed-note { background:linear-gradient(135deg,rgba(16,23,51,.98),rgba(12,17,38,.96)) !important; border-color:rgba(245,158,11,.25) !important; }
        .feed-post { background:linear-gradient(145deg,rgba(16,23,51,.98),rgba(8,13,30,.98)) !important; border-color:rgba(245,158,11,.22) !important; box-shadow:0 22px 70px -48px rgba(217,119,6,.3); }
        .feed-person { background:rgba(16,23,51,.75) !important; border-color:rgba(245,158,11,.18) !important; }
        .feed-future textarea, .feed-future input { background:rgba(10,15,36,.90) !important; border:1px solid rgba(245,158,11,.22); outline-color:#f59e0b; }
        .feed-future textarea:focus, .feed-future input:focus { border-color:rgba(245,158,11,.6) !important; box-shadow:0 0 0 3px rgba(217,119,6,.15); }
        .feed-future button { -webkit-tap-highlight-color:transparent; }
        .feed-future button:hover { border-color:rgba(245,158,11,.42); }
        .feed-future .btn-primary { background:linear-gradient(135deg,#f59e0b,#d97706 60%,#b45309) !important; color:#0f172a !important; border:1px solid rgba(253,230,138,.4); box-shadow:0 8px 26px -12px rgba(217,119,6,.65); }
        .feed-future .btn-primary:hover { background:linear-gradient(135deg,#fbbf24,#f59e0b 60%,#d97706) !important; box-shadow:0 10px 30px -10px rgba(217,119,6,.8); }
        @keyframes feed-float { from { transform:translate3d(0,-12px,0) scale(.94); } to { transform:translate3d(35px,30px,0) scale(1.08); } }
        @keyframes feed-enter { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        .feed-panel, .feed-composer, .feed-post { animation:feed-enter .55s both; }
        .feed-post:nth-child(2n) { animation-delay:70ms; }
        .feed-post:nth-child(3n) { animation-delay:120ms; }
        @media (prefers-reduced-motion:reduce) { .feed-orb,.feed-panel,.feed-composer,.feed-post { animation:none !important; transition:none !important; } }
      `}</style>
    </div>
  );
}

function PostCard({
  post,
  isOwn,
  currentUserId,
  onDelete,
  formatTime,
  onOpenProfile,
}: {
  post: Post;
  isOwn: boolean;
  currentUserId: string;
  onDelete: () => void;
  formatTime: (d: string) => string;
  onOpenProfile: (userId: string) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [counts, setCounts] = useState<Record<ReactionType, number>>({
    like: 0, love: 0, laugh: 0, wow: 0, sad: 0,
  });
  const [myReaction, setMyReactionState] = useState<ReactionType | null>(null);
  const [showReactionBar, setShowReactionBar] = useState(false);
  const [barPinned, setBarPinned] = useState(false);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [sendingComment, setSendingComment] = useState(false);

  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);

  useEffect(() => {
    let cancelled = false;
    getReactionSummary([post.id], currentUserId).then((summary) => {
      if (cancelled || !summary[post.id]) return;
      setCounts(summary[post.id].counts);
      setMyReactionState(summary[post.id].mine);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [post.id, currentUserId]);

  useEffect(() => {
    if (!showComments) return;
    let cancelled = false;
    getComments(post.id).then((list) => {
      if (!cancelled) setComments(list);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [showComments, post.id]);

  useEffect(() => {
    return () => {
      if (pressTimer.current) clearTimeout(pressTimer.current);
    };
  }, []);

  const closeReactionBar = () => {
    setShowReactionBar(false);
    setBarPinned(false);
  };

  const handleReact = async (reaction: ReactionType) => {
    const next = myReaction === reaction ? null : reaction;
    setMyReactionState(next);
    closeReactionBar();
    setCounts((prev) => {
      const updated = { ...prev };
      if (myReaction) updated[myReaction] = Math.max(0, updated[myReaction] - 1);
      if (next) updated[next] = updated[next] + 1;
      return updated;
    });
    try {
      await setMyReaction(post.id, next);
    } catch {
      setMyReactionState(myReaction);
    }
  };

  const startPress = () => {
    longPressed.current = false;
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = setTimeout(() => {
      longPressed.current = true;
      setShowReactionBar(true);
      setBarPinned(true);
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(10);
    }, 400);
  };

  const endPress = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
    if (longPressed.current) {
      setTimeout(() => { longPressed.current = false; }, 300);
    }
  };

  const handleReactClick = () => {
    if (longPressed.current) {
      longPressed.current = false;
      return;
    }
    handleReact(myReaction ?? 'like');
  };

  const handleAddComment = async () => {
    if (!commentText.trim()) return;
    setSendingComment(true);
    try {
      await addComment(post.id, commentText.trim());
      setCommentText('');
      const list = await getComments(post.id);
      setComments(list);
    } catch {
      // ignore
    }
    setSendingComment(false);
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await deleteComment(commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch {
      // ignore
    }
  };

  const totalReactions = Object.values(counts).reduce((a, b) => a + b, 0);
  const topReaction = (Object.entries(counts) as [ReactionType, number][])
    .sort((a, b) => b[1] - a[1])
    .filter(([, n]) => n > 0)[0]?.[0];

  return (
    <div className="feed-post rounded-3xl border border-amber-500/20 bg-gradient-to-br from-[#101733] to-[#080d1e] p-4 shadow-xl transition-all duration-300 hover:-translate-y-0.5 hover:border-amber-400/40 sm:p-6">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <button
            onClick={() => onOpenProfile(post.user_id)}
            className="shrink-0 transition hover:opacity-80"
            aria-label={`View ${post.author_name}'s profile`}
          >
            <Avatar name={post.author_name ?? 'U'} avatarUrl={post.author_avatar_url} size={10} />
          </button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <button
                onClick={() => onOpenProfile(post.user_id)}
                className="max-w-full truncate text-left font-bold text-amber-100 transition hover:text-amber-300"
              >
                {post.author_name ?? 'Unknown'}
              </button>
              <BadgeRow badge={post.author_badge} isAdmin={post.author_is_admin} />
            </div>
            <p className="truncate text-xs text-amber-400/60">@{post.author_username} · {formatTime(post.created_at)}</p>
          </div>
        </div>
        {isOwn && (
          <div className="relative shrink-0">
            <button
              onClick={() => setConfirmDelete(!confirmDelete)}
              className="touch-manipulation rounded-lg p-2.5 text-amber-400/50 transition hover:bg-amber-500/10 hover:text-rose-400"
              aria-label="Post options"
            >
              <Trash2 size={16} />
            </button>
            {confirmDelete && (
              <div className="absolute right-0 top-11 z-10 rounded-lg border border-amber-500/30 bg-[#0c1126] p-2 shadow-2xl">
                <button
                  onClick={() => { onDelete(); setConfirmDelete(false); }}
                  className="block touch-manipulation whitespace-nowrap rounded px-4 py-2.5 text-sm font-medium text-rose-400 transition hover:bg-amber-500/10"
                >
                  Delete post
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {post.text_content && (
        <p className="mb-3 whitespace-pre-wrap break-words leading-relaxed text-amber-100/90">
          {filterBadWords(post.text_content)}
        </p>
      )}

      {post.media_url && post.content_type === 'photo' && (
        <img
          src={post.media_url}
          alt="Post"
          loading="lazy"
          decoding="async"
          className="max-h-96 w-full rounded-xl object-cover border border-amber-500/15"
        />
      )}
      {post.media_url && post.content_type === 'video' && (
        <video
          src={post.media_url}
          controls
          playsInline
          preload="metadata"
          className="max-h-96 w-full rounded-xl border border-amber-500/15"
        />
      )}

      {/* Reactions & comments bar */}
      <div className="mt-3 flex items-center gap-1 border-t border-amber-500/15 pt-2">
        {barPinned && <div className="fixed inset-0 z-[5]" onClick={closeReactionBar} />}
        <div
          className="relative"
          onPointerEnter={(e) => { if (e.pointerType === 'mouse') setShowReactionBar(true); }}
          onPointerLeave={(e) => { if (e.pointerType === 'mouse') setShowReactionBar(false); }}
        >
          <button
            onClick={handleReactClick}
            onTouchStart={startPress}
            onTouchEnd={endPress}
            onTouchMove={endPress}
            onTouchCancel={endPress}
            onContextMenu={(e) => e.preventDefault()}
            className={`flex min-h-10 touch-manipulation select-none items-center gap-1.5 rounded-lg px-3 py-2 text-sm transition [-webkit-touch-callout:none] ${
              myReaction ? 'text-amber-300 font-bold' : 'text-amber-400/60 hover:bg-amber-500/10 hover:text-amber-200'
            }`}
          >
            <span className="text-base leading-none">{REACTION_EMOJI[myReaction ?? 'like']}</span>
            {myReaction
              ? myReaction.charAt(0).toUpperCase() + myReaction.slice(1)
              : 'React'}
          </button>
          {showReactionBar && (
            <div className="absolute bottom-full left-0 z-10 mb-1 flex gap-0.5 rounded-full border border-amber-500/30 bg-[#0c1126] p-1 shadow-2xl">
              {(Object.keys(REACTION_EMOJI) as ReactionType[]).map((reaction) => (
                <button
                  key={reaction}
                  onClick={() => handleReact(reaction)}
                  className={`touch-manipulation rounded-full p-2 text-2xl leading-none transition hover:scale-125 active:scale-125 sm:p-1.5 sm:text-lg ${
                    myReaction === reaction ? 'bg-amber-500/20' : ''
                  }`}
                  aria-label={reaction}
                >
                  {REACTION_EMOJI[reaction]}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={() => setShowComments(!showComments)}
          className="flex min-h-10 touch-manipulation items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-amber-400/60 transition hover:bg-amber-500/10 hover:text-amber-200"
        >
          <MessageCircle size={16} />
          Comment{comments.length > 0 ? ` (${comments.length})` : ''}
        </button>
        {(totalReactions > 0 || topReaction) && (
          <span className="ml-auto flex items-center gap-1 pr-2 text-xs font-semibold text-amber-400/60">
            {topReaction && <span>{REACTION_EMOJI[topReaction]}</span>}
            {totalReactions}
          </span>
        )}
      </div>

      {/* Comments section */}
      {showComments && (
        <div className="mt-3 space-y-3 border-t border-amber-500/15 pt-3">
          {comments.length === 0 ? (
            <p className="text-xs text-amber-400/50">No comments yet. Be the first!</p>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="flex items-start gap-2">
                <button
                  onClick={() => onOpenProfile(comment.user_id)}
                  className="shrink-0 transition hover:opacity-80"
                  aria-label={`View ${comment.author_name}'s profile`}
                >
                  <Avatar name={comment.author_name} avatarUrl={comment.author_avatar_url} size={7} />
                </button>
                <div className="min-w-0 flex-1 rounded-xl bg-[#0c1126] px-3 py-2 border border-amber-500/15">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      onClick={() => onOpenProfile(comment.user_id)}
                      className="min-w-0 truncate text-left text-xs font-semibold text-amber-200 transition hover:text-amber-400"
                    >
                      {comment.author_name}
                    </button>
                    {comment.user_id === currentUserId && (
                      <button
                        onClick={() => handleDeleteComment(comment.id)}
                        className="-m-1.5 shrink-0 touch-manipulation rounded p-2 text-amber-400/40 transition hover:text-rose-400"
                        aria-label="Delete comment"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap break-words text-xs text-amber-100/80">
                    {filterBadWords(comment.content)}
                  </p>
                </div>
              </div>
            ))
          )}
          <div className="flex items-center gap-2">
            <input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddComment(); } }}
              enterKeyHint="send"
              placeholder="Write a comment..."
              maxLength={1000}
              className="min-w-0 flex-1 rounded-full bg-[#0c1126] px-4 py-2.5 text-base text-amber-100 placeholder-amber-400/40 border border-amber-500/20 focus:border-amber-400/60 focus:outline-none sm:py-2 sm:text-xs"
            />
            <button
              onClick={handleAddComment}
              disabled={sendingComment || !commentText.trim()}
              className="shrink-0 touch-manipulation rounded-full bg-gradient-to-r from-amber-400 to-amber-600 p-2.5 text-slate-950 transition hover:brightness-110 disabled:opacity-40"
              aria-label="Send comment"
            >
              {sendingComment ? <Loader2 size={16} className="animate-spin" /> : <SendHorizontal size={16} />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const REACTION_EMOJI: Record<ReactionType, string> = {
  like: '👍',
  love: '❤️',
  laugh: '😂',
  wow: '😮',
  sad: '😢',
};