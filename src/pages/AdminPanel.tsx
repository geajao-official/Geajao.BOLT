import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type ChangeEvent,
  type ReactNode,
} from 'react';
import {
  ArrowLeft,
  Users,
  FileText,
  Images,
  ShieldCheck,
  ShieldX,
  Shield,
  Ban,
  Clock,
  CheckCircle,
  Trash2,
  Upload,
  Loader2,
  Search,
  X,
  Image as ImageIcon,
  Music,
  Award,
} from 'lucide-react';
import {
  adminGetAllProfiles,
  adminGetIdCardSignedUrl,
  adminUpdateVerification,
  adminSetBlocked,
  adminSetRestriction,
  adminRemovePost,
  adminGetAllPosts,
  adminAddSlideshowPhoto,
  adminRemoveSlideshowPhoto,
  adminGetAllSlideshowPhotos,
  adminDeleteUser,
  adminSetSiteLogo,
  adminGetSiteLogo,
  adminSetTeamLogo,
  adminGetTeamLogo,
  adminAddMusicTrack,
  adminDeleteMusicTrack,
  adminListMusicTracks,
  adminSetBadge,
  adminSetAdmin,
  moderatorGetProfiles,
  moderatorSetBadge,
  type AdminBadge,
  type ModeratorProfile,
} from '@/lib/admin';
import { invalidateLogoCache } from '@/lib/siteSettings';
import { invalidateMusicCache } from '@/lib/backgroundMusic';
import type { AdminProfile } from '@/types';
import { BadgeRow, BADGE_META } from '@/components/Badge';
import { supabase } from '@/lib/supabase';

interface AdminPanelProps {
  pin: string;
  role: 'admin' | 'moderator';
  onExit: () => void;
}

type Tab = 'users' | 'posts' | 'slideshow' | 'logo' | 'music';
type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';

export default function AdminPanel({
  pin,
  role,
  onExit,
}: AdminPanelProps) {
  if (role === 'moderator') {
    return <ModeratorPanel onExit={onExit} />;
  }

  return <AdminDashboard pin={pin} onExit={onExit} />;
}

function ModeratorPanel({ onExit }: { onExit: () => void }) {
  const [profiles, setProfiles] = useState<ModeratorProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);

  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const result = await moderatorGetProfiles();
      setProfiles(result ?? []);
    } catch (err) {
      console.error('Failed to load moderator profiles:', err);
      setError('Could not load profiles. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchProfiles();
  }, [fetchProfiles]);

  const handleSetBadge = async (
    userId: string,
    badge: AdminBadge,
  ) => {
    setSavingId(userId);
    setError('');

    try {
      await moderatorSetBadge(userId, badge);
      await fetchProfiles();
    } catch (err) {
      console.error('Failed to update badge:', err);
      setError('Could not update the badge. Please try again.');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="auth-future relative min-h-screen bg-[#010409] text-white">
      {/* Background atmosphere */}
      <div
        aria-hidden="true"
        className="auth-atmosphere pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="auth-grid absolute inset-0" />
        <div className="auth-aurora auth-aurora-one absolute left-1/2 top-[-12rem] h-[30rem] w-[30rem] -translate-x-1/2 rounded-full" />
        <div className="auth-aurora auth-aurora-two absolute bottom-[-14rem] left-[-8rem] h-[28rem] w-[28rem] rounded-full" />
        <div className="auth-aurora auth-aurora-three absolute right-[-10rem] top-1/4 h-[30rem] w-[30rem] rounded-full" />
        <div className="auth-scan absolute inset-x-0 top-0 h-24" />
        <div className="auth-stars absolute inset-0" />
      </div>

      <header className="sticky top-0 z-20 border-b border-amber-400/20 bg-[#0d0902]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={onExit}
            className="rounded-xl p-2 text-amber-200/70 transition hover:bg-white/5 hover:text-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            aria-label="Exit moderator panel"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-lg font-bold text-white">Moderator Panel</h1>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-5xl space-y-3 px-4 py-6">
        {error && <p className="text-sm text-red-300">{error}</p>}

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 size={28} className="animate-spin text-amber-400" />
          </div>
        ) : profiles.length === 0 ? (
          <p className="py-12 text-center text-zinc-400">
            No profiles found.
          </p>
        ) : (
          profiles.map((profile) => (
            <div
              key={profile.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-400/20 bg-[#0d0902]/90 p-4 shadow-lg backdrop-blur-xl"
            >
              <div>
                <p className="font-semibold text-white">
                  {profile.full_name || 'Unnamed user'}
                </p>
                <p className="text-xs text-zinc-400">
                  @{profile.username || 'unknown'}
                </p>
                {profile.badge && (
                  <p className="mt-1 text-xs text-amber-400">
                    Current badge: {BADGE_META[profile.badge].label}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {(Object.keys(BADGE_META) as Exclude<AdminBadge, null>[]).map(
                  (badge) => (
                    <button
                      key={badge}
                      type="button"
                      disabled={savingId === profile.id}
                      onClick={() =>
                        void handleSetBadge(profile.id, badge)
                      }
                      className="rounded-xl border border-amber-400/30 bg-amber-400/5 px-3 py-1.5 text-xs font-medium text-amber-300 transition hover:bg-amber-400/15 disabled:opacity-50"
                    >
                      {savingId === profile.id ? (
                        <Loader2
                          size={14}
                          className="inline animate-spin"
                        />
                      ) : (
                        BADGE_META[badge].label
                      )}
                    </button>
                  ),
                )}

                {profile.badge && (
                  <button
                    type="button"
                    disabled={savingId === profile.id}
                    onClick={() =>
                      void handleSetBadge(profile.id, null)
                    }
                    className="rounded-xl border border-amber-400/20 bg-black/30 px-3 py-1.5 text-xs font-medium text-zinc-400 transition hover:bg-white/5 disabled:opacity-50"
                  >
                    Remove badge
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </main>
    </div>
  );
}

function AdminDashboard({
  pin,
  onExit,
}: {
  pin: string;
  onExit: () => void;
}) {
  const [tab, setTab] = useState<Tab>('users');
  const [profiles, setProfiles] = useState<AdminProfile[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [slideshowPhotos, setSlideshowPhotos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const slideshowInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const teamLogoInputRef = useRef<HTMLInputElement>(null);
  const musicInputRef = useRef<HTMLInputElement>(null);

  const [siteLogo, setSiteLogo] = useState<string | null>(null);
  const [teamLogo, setTeamLogo] = useState<string | null>(null);
  const [musicTracks, setMusicTracks] = useState<
    { id: string; title: string; url: string; created_at: string }[]
  >([]);
  const [musicError, setMusicError] = useState('');

  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminGetAllProfiles(pin);
      setProfiles(data || []);
    } catch (err) {
      console.error('Failed to fetch profiles:', err);
    } finally {
      setLoading(false);
    }
  }, [pin]);

  const fetchPosts = useCallback(async () => {
    try {
      const data = await adminGetAllPosts(pin);
      setPosts(data || []);
    } catch (err) {
      console.error('Failed to fetch posts:', err);
    }
  }, [pin]);

  const fetchSlideshow = useCallback(async () => {
    try {
      const data = await adminGetAllSlideshowPhotos(pin);
      setSlideshowPhotos(data || []);
    } catch (err) {
      console.error('Failed to fetch slideshow:', err);
    }
  }, [pin]);

  const getIdCardSignedUrl = useCallback(
    (userId: string) => adminGetIdCardSignedUrl(pin, userId),
    [pin],
  );

  useEffect(() => {
    void fetchProfiles();
  }, [fetchProfiles]);

  useEffect(() => {
    if (tab === 'posts') void fetchPosts();
    if (tab === 'slideshow') void fetchSlideshow();

    if (tab === 'logo') {
      adminGetSiteLogo(pin)
        .then(setSiteLogo)
        .catch((err) => console.error('Failed to fetch logo:', err));

      adminGetTeamLogo(pin)
        .then(setTeamLogo)
        .catch((err) => console.error('Failed to fetch team logo:', err));
    }

    if (tab === 'music') {
      adminListMusicTracks(pin)
        .then(setMusicTracks)
        .catch((err) => console.error('Failed to fetch music tracks:', err));
    }
  }, [tab, fetchPosts, fetchSlideshow, pin]);

  useEffect(() => {
    setMusicError('');
  }, [tab]);

  const handleVerify = async (
    userId: string,
    status: VerificationStatus,
  ) => {
    setActionLoading(`verify-${userId}`);
    try {
      await adminUpdateVerification(pin, userId, status);
      await fetchProfiles();
    } catch (err) {
      console.error('Failed to update verification:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleBlock = async (userId: string, blocked: boolean) => {
    setActionLoading(`block-${userId}`);
    try {
      await adminSetBlocked(pin, userId, blocked);
      await fetchProfiles();
    } catch (err) {
      console.error('Failed to update block status:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRestrict = async (userId: string, days: number) => {
    setActionLoading(`restrict-${userId}`);
    const until =
      days > 0
        ? new Date(Date.now() + days * 86400000).toISOString()
        : null;

    try {
      await adminSetRestriction(pin, userId, until);
      await fetchProfiles();
    } catch (err) {
      console.error('Failed to set restriction:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemovePost = async (postId: string) => {
    setActionLoading(`post-${postId}`);
    try {
      await adminRemovePost(pin, postId);
      await fetchPosts();
    } catch (err) {
      console.error('Failed to remove post:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSlideshowUpload = async (
    e: ChangeEvent<HTMLInputElement>,
  ) => {
    const files = e.target.files;
    if (!files?.length) return;

    setActionLoading('add-slideshow');

    try {
      for (const file of Array.from(files)) {
        const fileExt = file.name.split('.').pop();
        const fileName = `slideshow_${Date.now()}_${Math.random()
          .toString(36)
          .slice(2)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('slideshow')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('slideshow')
          .getPublicUrl(fileName);

        await adminAddSlideshowPhoto(
          pin,
          urlData.publicUrl,
          slideshowPhotos.length,
        );
      }

      await fetchSlideshow();
    } catch (err) {
      console.error('Failed to upload slideshow photo:', err);
    } finally {
      setActionLoading(null);
      if (slideshowInputRef.current) slideshowInputRef.current.value = '';
    }
  };

  const handleRemoveSlideshow = async (photoId: string) => {
    setActionLoading(`slideshow-${photoId}`);
    try {
      await adminRemoveSlideshowPhoto(pin, photoId);
      await fetchSlideshow();
    } catch (err) {
      console.error('Failed to remove slideshow photo:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    setActionLoading(`delete-${userId}`);
    try {
      await adminDeleteUser(pin, userId);
      await fetchProfiles();
    } catch (err) {
      console.error('Failed to delete user:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSetBadge = async (userId: string, badge: AdminBadge) => {
    setActionLoading(`badge-${userId}`);
    try {
      await adminSetBadge(pin, userId, badge);
      await fetchProfiles();
    } catch (err) {
      console.error('Failed to set badge:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSetAdmin = async (userId: string, isAdmin: boolean) => {
    setActionLoading(`admin-${userId}`);
    try {
      await adminSetAdmin(pin, userId, isAdmin);
      await fetchProfiles();
    } catch (err) {
      console.error('Failed to set admin status:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleLogoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setActionLoading('upload-logo');

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `logo_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('slideshow')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('slideshow')
        .getPublicUrl(fileName);

      await adminSetSiteLogo(pin, urlData.publicUrl);
      setSiteLogo(urlData.publicUrl);
      invalidateLogoCache();
    } catch (err) {
      console.error('Failed to upload logo:', err);
    } finally {
      setActionLoading(null);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

  const handleRemoveLogo = async () => {
    setActionLoading('remove-logo');
    try {
      await adminSetSiteLogo(pin, null);
      setSiteLogo(null);
      invalidateLogoCache();
    } catch (err) {
      console.error('Failed to remove logo:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleTeamLogoUpload = async (
    e: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setActionLoading('upload-team-logo');

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `team_logo_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('slideshow')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('slideshow')
        .getPublicUrl(fileName);

      await adminSetTeamLogo(pin, urlData.publicUrl);
      setTeamLogo(urlData.publicUrl);
      invalidateLogoCache();
    } catch (err) {
      console.error('Failed to upload team logo:', err);
    } finally {
      setActionLoading(null);
      if (teamLogoInputRef.current) teamLogoInputRef.current.value = '';
    }
  };

  const handleRemoveTeamLogo = async () => {
    setActionLoading('remove-team-logo');
    try {
      await adminSetTeamLogo(pin, null);
      setTeamLogo(null);
      invalidateLogoCache();
    } catch (err) {
      console.error('Failed to remove team logo:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleMusicUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;

    const audioFiles = Array.from(files).filter((file) =>
      file.type.startsWith('audio/'),
    );

    if (!audioFiles.length) {
      setMusicError('Please choose audio files (MP3, WAV, OGG, etc.).');
      if (musicInputRef.current) musicInputRef.current.value = '';
      return;
    }

    setActionLoading('upload-music');
    setMusicError('');

    try {
      for (const file of audioFiles) {
        const fileExt = file.name.split('.').pop() || 'mp3';
        const fileName = `music_${Date.now()}_${Math.random()
          .toString(36)
          .slice(2)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('background-music')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('background-music')
          .getPublicUrl(fileName);

        const title = file.name.replace(/\.[^.]+$/, '');
        await adminAddMusicTrack(pin, title, urlData.publicUrl);
      }

      const updated = await adminListMusicTracks(pin);
      setMusicTracks(updated);
      invalidateMusicCache();
    } catch (err) {
      console.error('Failed to upload music:', err);
      setMusicError('Could not upload one or more files. Please try again.');
    } finally {
      setActionLoading(null);
      if (musicInputRef.current) musicInputRef.current.value = '';
    }
  };

  const handleDeleteTrack = async (trackId: string) => {
    setActionLoading(`delete-track-${trackId}`);
    setMusicError('');

    try {
      await adminDeleteMusicTrack(pin, trackId);
      setMusicTracks((prev) =>
        prev.filter((track) => track.id !== trackId),
      );
      invalidateMusicCache();
    } catch (err) {
      console.error('Failed to delete track:', err);
      setMusicError('Could not remove the track. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredProfiles = profiles.filter(
    (profile) =>
      profile.username.toLowerCase().includes(search.toLowerCase()) ||
      profile.full_name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="auth-future relative min-h-screen bg-[#010409] text-white">
      {/* Background atmosphere */}
      <div
        aria-hidden="true"
        className="auth-atmosphere pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="auth-grid absolute inset-0" />
        <div className="auth-aurora auth-aurora-one absolute left-1/2 top-[-12rem] h-[30rem] w-[30rem] -translate-x-1/2 rounded-full" />
        <div className="auth-aurora auth-aurora-two absolute bottom-[-14rem] left-[-8rem] h-[28rem] w-[28rem] rounded-full" />
        <div className="auth-aurora auth-aurora-three absolute right-[-10rem] top-1/4 h-[30rem] w-[30rem] rounded-full" />
        <div className="auth-scan absolute inset-x-0 top-0 h-24" />
        <div className="auth-stars absolute inset-0" />
      </div>

      <header className="sticky top-0 z-25 border-b border-amber-400/20 bg-[#0d0902]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onExit}
              className="rounded-xl p-2 text-amber-200/70 transition hover:bg-white/5 hover:text-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              aria-label="Exit admin panel"
            >
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-lg font-bold text-white">Admin Panel</h1>
          </div>
          <span className="rounded-full border border-amber-400/20 bg-black/30 px-3 py-1 text-xs text-amber-300/80">
            Geajao
          </span>
        </div>

        <div className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4">
          <TabButton
            active={tab === 'users'}
            onClick={() => setTab('users')}
            icon={<Users size={16} />}
            label="Users"
          />
          <TabButton
            active={tab === 'posts'}
            onClick={() => setTab('posts')}
            icon={<FileText size={16} />}
            label="Posts"
          />
          <TabButton
            active={tab === 'slideshow'}
            onClick={() => setTab('slideshow')}
            icon={<Images size={16} />}
            label="Slideshow"
          />
          <TabButton
            active={tab === 'logo'}
            onClick={() => setTab('logo')}
            icon={<ImageIcon size={16} />}
            label="Logo"
          />
          <TabButton
            active={tab === 'music'}
            onClick={() => setTab('music')}
            icon={<Music size={16} />}
            label="Music"
          />
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-5xl px-4 py-6">
        {tab === 'users' && (
          <div>
            <div className="relative mb-4">
              <Search
                size={18}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search users..."
                className="w-full rounded-xl border border-amber-400/20 bg-black/30 py-3 pl-10 pr-4 text-sm text-zinc-100 placeholder-zinc-500 transition focus:border-amber-400/70 focus:outline-none focus:ring-4 focus:ring-amber-400/10"
              />
            </div>

            {loading ? (
              <div className="flex justify-center py-20">
                <Loader2 size={28} className="animate-spin text-amber-400" />
              </div>
            ) : (
              <div className="space-y-3">
                {filteredProfiles.map((profile) => (
                  <UserCard
                    key={profile.id}
                    profile={profile}
                    actionLoading={actionLoading}
                    onVerify={handleVerify}
                    onBlock={handleBlock}
                    onRestrict={handleRestrict}
                    onDelete={handleDeleteUser}
                    onSetBadge={handleSetBadge}
                    onSetAdmin={handleSetAdmin}
                    onGetIdCardSignedUrl={getIdCardSignedUrl}
                  />
                ))}

                {filteredProfiles.length === 0 && (
                  <p className="py-12 text-center text-zinc-400">
                    No users found.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {tab === 'posts' && (
          <div className="space-y-3">
            {posts.length === 0 ? (
              <p className="py-12 text-center text-zinc-400">No posts yet.</p>
            ) : (
              posts.map((post) => (
                <div
                  key={post.id}
                  className={`rounded-2xl border bg-[#0d0902]/90 p-4 shadow-lg backdrop-blur-xl ${
                    post.is_removed
                      ? 'border-red-400/20 opacity-60'
                      : 'border-amber-400/20'
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <div>
                      <span className="text-sm font-semibold text-white">
                        {post.author_name ?? 'Unknown'}
                      </span>
                      <span className="ml-2 text-xs text-zinc-400">
                        @{post.author_username}
                      </span>
                    </div>
                    <span className="text-xs text-zinc-400">
                      {new Date(post.created_at).toLocaleString()}
                    </span>
                  </div>

                  {post.text_content && (
                    <p className="mb-2 text-sm text-zinc-300">
                      {post.text_content}
                    </p>
                  )}

                  {post.media_url && (
                    <div className="mb-2">
                      {post.content_type === 'photo' ? (
                        <img
                          src={post.media_url}
                          alt="Post"
                          className="max-h-48 rounded-xl border border-amber-400/20"
                        />
                      ) : (
                        <video
                          src={post.media_url}
                          className="max-h-48 rounded-xl border border-amber-400/20"
                          controls
                        />
                      )}
                    </div>
                  )}

                  {post.is_removed ? (
                    <span className="text-xs text-red-300">Removed</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void handleRemovePost(post.id)}
                      disabled={actionLoading === `post-${post.id}`}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-1.5 text-xs font-semibold text-red-300 transition hover:bg-red-400/20 disabled:opacity-50"
                    >
                      {actionLoading === `post-${post.id}` ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Trash2 size={14} />
                      )}
                      Remove Post
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'slideshow' && (
          <div>
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="text-sm text-zinc-400">
                These photos appear on the welcome page slideshow.
              </p>
              <button
                type="button"
                onClick={() => slideshowInputRef.current?.click()}
                disabled={actionLoading === 'add-slideshow'}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-700 via-amber-600 to-yellow-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-amber-500/25 transition hover:brightness-110 disabled:opacity-50"
              >
                {actionLoading === 'add-slideshow' ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Upload size={16} />
                )}
                Upload Photos
              </button>
              <input
                ref={slideshowInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleSlideshowUpload}
                className="hidden"
              />
            </div>

            {slideshowPhotos.length === 0 ? (
              <div className="rounded-2xl border border-amber-400/20 bg-[#0d0902]/90 p-8 text-center backdrop-blur-xl">
                <p className="text-zinc-400">
                  No slideshow photos yet. The welcome page will show default
                  images.
                </p>
                <p className="mt-2 text-xs text-zinc-500">
                  Click “Upload Photos” to select image files from your device.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {slideshowPhotos.map((photo) => (
                  <div
                    key={photo.id}
                    className="group relative overflow-hidden rounded-2xl border border-amber-400/20 bg-[#0d0902]/90"
                  >
                    <img
                      src={photo.photo_url}
                      alt="Slideshow"
                      className="h-40 w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => void handleRemoveSlideshow(photo.id)}
                      disabled={actionLoading === `slideshow-${photo.id}`}
                      aria-label="Remove slideshow photo"
                      className="absolute right-2 top-2 rounded-xl bg-black/70 p-2 text-white opacity-0 transition group-hover:opacity-100 disabled:opacity-50"
                    >
                      {actionLoading === `slideshow-${photo.id}` ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <X size={14} />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-8 rounded-2xl border border-amber-400/20 bg-[#0d0902]/90 p-4 backdrop-blur-xl">
              <p className="text-xs text-zinc-400">
                Default fallback images are shown when no custom slideshow
                photos are set.
              </p>
            </div>
          </div>
        )}

        {tab === 'logo' && (
          <div>
            <p className="mb-4 text-sm text-zinc-400">
              Upload a custom logo to replace the “Geajao” text everywhere in
              the app. A wide image with a transparent background works best
              (PNG or SVG).
            </p>

            <div className="rounded-2xl border border-amber-400/20 bg-[#0d0902]/90 p-6 backdrop-blur-xl">
              <div className="relative mb-6 overflow-hidden rounded-xl border border-amber-400/20 bg-black/40 p-10">
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background:
                      'radial-gradient(ellipse 70% 60% at 50% 45%, rgba(212,175,55,0.08), transparent 70%)',
                  }}
                />

                {siteLogo ? (
                  <div className="relative flex items-center justify-center">
                    <div
                      aria-hidden
                      className="pointer-events-none absolute h-36 w-64 rounded-full bg-amber-400/10 blur-3xl"
                    />
                    <img
                      src={siteLogo}
                      alt="Site logo"
                      className="relative max-h-28 max-w-full object-contain drop-shadow-[0_8px_24px_rgba(0,0,0,0.5)] transition-transform duration-300 ease-out hover:scale-[1.04]"
                    />
                  </div>
                ) : (
                  <div className="relative flex items-center justify-center">
                    <span className="text-3xl font-bold tracking-tight text-white">
                      Geajao
                    </span>
                  </div>
                )}

                <div className="absolute left-3 top-3 rounded-full border border-amber-400/20 bg-black/60 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-amber-300">
                  Live preview
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={actionLoading === 'upload-logo'}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-700 via-amber-600 to-yellow-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-amber-500/25 transition hover:brightness-110 disabled:opacity-50"
                >
                  {actionLoading === 'upload-logo' ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Upload size={16} />
                  )}
                  {siteLogo ? 'Change Logo' : 'Upload Logo'}
                </button>

                {siteLogo && (
                  <button
                    type="button"
                    onClick={() => void handleRemoveLogo()}
                    disabled={actionLoading === 'remove-logo'}
                    className="inline-flex items-center gap-2 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-2.5 text-sm font-semibold text-red-300 transition hover:bg-red-400/20 disabled:opacity-50"
                  >
                    {actionLoading === 'remove-logo' ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Trash2 size={16} />
                    )}
                    Remove Logo
                  </button>
                )}
              </div>

              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
              />
            </div>

            <div className="mt-4 rounded-2xl border border-amber-400/20 bg-[#0d0902]/90 p-4 backdrop-blur-xl">
              <p className="text-xs text-zinc-400">
                The change is live immediately — visitors will see the new logo
                on their next page load.
              </p>
            </div>

            <h3 className="mb-3 mt-8 text-sm font-semibold text-zinc-300">
              Team Logo
            </h3>
            <p className="mb-4 text-sm text-zinc-400">
              A circular badge shown in the site footer. A square image works
              best.
            </p>

            <div className="rounded-2xl border border-amber-400/20 bg-[#0d0902]/90 p-6 backdrop-blur-xl">
              <div className="relative mb-6 overflow-hidden rounded-xl border border-amber-400/20 bg-black/40 p-10">
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background:
                      'radial-gradient(ellipse 70% 60% at 50% 45%, rgba(212,175,55,0.08), transparent 70%)',
                  }}
                />

                {teamLogo ? (
                  <div className="relative flex items-center justify-center">
                    <div
                      aria-hidden
                      className="pointer-events-none absolute h-24 w-24 rounded-full bg-amber-400/10 blur-2xl"
                    />
                    <span className="relative inline-flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border border-amber-400/30 bg-black/40 shadow-xl transition-transform duration-300 hover:scale-[1.04]">
                      <img
                        src={teamLogo}
                        alt="Team logo"
                        className="relative h-full w-full object-cover"
                      />
                    </span>
                  </div>
                ) : (
                  <div className="relative flex items-center justify-center">
                    <span className="flex h-28 w-28 items-center justify-center rounded-full border border-dashed border-amber-400/30 text-xs font-medium uppercase tracking-wider text-zinc-500">
                      No team logo
                    </span>
                  </div>
                )}

                <div className="absolute left-3 top-3 rounded-full border border-amber-400/20 bg-black/60 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-amber-300">
                  Footer badge
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => teamLogoInputRef.current?.click()}
                  disabled={actionLoading === 'upload-team-logo'}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-700 via-amber-600 to-yellow-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-amber-500/25 transition hover:brightness-110 disabled:opacity-50"
                >
                  {actionLoading === 'upload-team-logo' ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Upload size={16} />
                  )}
                  {teamLogo ? 'Change Team Logo' : 'Upload Team Logo'}
                </button>

                {teamLogo && (
                  <button
                    type="button"
                    onClick={() => void handleRemoveTeamLogo()}
                    disabled={actionLoading === 'remove-team-logo'}
                    className="inline-flex items-center gap-2 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-2.5 text-sm font-semibold text-red-300 transition hover:bg-red-400/20 disabled:opacity-50"
                  >
                    {actionLoading === 'remove-team-logo' ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Trash2 size={16} />
                    )}
                    Remove Team Logo
                  </button>
                )}
              </div>

              <input
                ref={teamLogoInputRef}
                type="file"
                accept="image/*"
                onChange={handleTeamLogoUpload}
                className="hidden"
              />
            </div>
          </div>
        )}

        {tab === 'music' && (
          <div>
            <p className="mb-4 text-sm text-zinc-400">
              Build a library of background songs. Users pick which track they
              want to listen to from their settings page. MP3 files work best.
            </p>

            <div className="mb-4 flex items-center justify-between">
              <span className="text-xs text-zinc-400">
                {musicTracks.length} track
                {musicTracks.length === 1 ? '' : 's'} in the library
              </span>

              <button
                type="button"
                onClick={() => musicInputRef.current?.click()}
                disabled={actionLoading === 'upload-music'}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-700 via-amber-600 to-yellow-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-amber-500/25 transition hover:brightness-110 disabled:opacity-50"
              >
                {actionLoading === 'upload-music' ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Upload size={16} />
                )}
                Upload Tracks
              </button>

              <input
                ref={musicInputRef}
                type="file"
                accept="audio/*"
                multiple
                onChange={handleMusicUpload}
                className="hidden"
              />
            </div>

            {musicTracks.length === 0 ? (
              <div className="rounded-2xl border border-amber-400/20 bg-[#0d0902]/90 p-8 text-center backdrop-blur-xl">
                <span className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl border border-dashed border-amber-400/30 text-amber-400">
                  <Music size={28} />
                </span>
                <p className="text-sm text-zinc-300">
                  No tracks uploaded yet.
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Upload an MP3 to add it to the library.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {musicTracks.map((track, index) => (
                  <div
                    key={track.id}
                    className="flex items-center gap-3 rounded-2xl border border-amber-400/20 bg-[#0d0902]/90 p-3 transition hover:border-amber-400/40 backdrop-blur-xl"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-400/20 bg-black/30 text-xs font-semibold text-amber-300">
                      {index + 1}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-200">
                        {track.title}
                      </p>
                      <p className="truncate text-xs text-zinc-500">
                        {track.url.split('/').pop()}
                      </p>
                    </div>

                    <audio
                      src={track.url}
                      controls
                      className="h-8 max-w-[40%]"
                    />

                    <button
                      type="button"
                      onClick={() => void handleDeleteTrack(track.id)}
                      disabled={
                        actionLoading === `delete-track-${track.id}`
                      }
                      className="rounded-xl border border-red-400/30 bg-red-400/10 p-2 text-red-300 transition hover:bg-red-400/20 disabled:opacity-50"
                      aria-label="Delete track"
                    >
                      {actionLoading === `delete-track-${track.id}` ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Trash2 size={14} />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {musicError && (
              <div className="mt-3 rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-300">
                {musicError}
              </div>
            )}

            <div className="mt-4 rounded-2xl border border-amber-400/20 bg-[#0d0902]/90 p-4 backdrop-blur-xl">
              <p className="text-xs text-zinc-400">
                New tracks appear instantly for users in their settings page,
                where they can pick the one they like and play or pause it.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
        active
          ? 'border-amber-400 text-amber-300'
          : 'border-transparent text-zinc-400 hover:text-zinc-200'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function UserCard({
  profile,
  actionLoading,
  onVerify,
  onBlock,
  onRestrict,
  onDelete,
  onSetBadge,
  onSetAdmin,
  onGetIdCardSignedUrl,
}: {
  profile: AdminProfile;
  actionLoading: string | null;
  onVerify: (id: string, status: VerificationStatus) => void;
  onBlock: (id: string, blocked: boolean) => void;
  onRestrict: (id: string, days: number) => void;
  onDelete: (id: string) => void;
  onSetBadge: (id: string, badge: AdminBadge) => void;
  onSetAdmin: (id: string, isAdmin: boolean) => void;
  onGetIdCardSignedUrl: (userId: string) => Promise<string>;
}) {
  const [showIdCard, setShowIdCard] = useState(false);
  const [idCardUrl, setIdCardUrl] = useState<string | null>(null);
  const [idCardLoading, setIdCardLoading] = useState(false);
  const [idCardError, setIdCardError] = useState('');
  const [showRestrictMenu, setShowRestrictMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showBadgeMenu, setShowBadgeMenu] = useState(false);

  const handleIdCardToggle = async () => {
    if (showIdCard) {
      setShowIdCard(false);
      setIdCardUrl(null);
      setIdCardError('');
      return;
    }

    setShowIdCard(true);
    setIdCardLoading(true);
    setIdCardError('');

    try {
      const signedUrl = await onGetIdCardSignedUrl(profile.id);
      setIdCardUrl(signedUrl);
    } catch (error) {
      console.error('Could not load ID card:', error);
      setIdCardError('Could not load ID card. Please try again.');
    } finally {
      setIdCardLoading(false);
    }
  };

  const statusBadge: Record<string, { label: string; color: string }> = {
    verified: {
      label: 'Verified',
      color: 'bg-green-500/10 text-green-300 border-green-500/30',
    },
    pending: {
      label: 'Pending',
      color: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
    },
    rejected: {
      label: 'Rejected',
      color: 'bg-red-500/10 text-red-300 border-red-500/30',
    },
    unverified: {
      label: 'Unverified',
      color: 'bg-black/30 text-zinc-400 border-amber-400/20',
    },
  };

  const isRestricted =
    profile.restricted_until &&
    new Date(profile.restricted_until) > new Date();

  const badge =
    statusBadge[profile.verification_status] ?? statusBadge.unverified;

  return (
    <div className="rounded-2xl border border-amber-400/20 bg-[#0d0902]/90 p-4 transition hover:border-amber-400/40 backdrop-blur-xl shadow-lg">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 text-sm font-bold text-white shadow-md">
            {profile.full_name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-white">{profile.full_name}</p>
            <p className="text-xs text-zinc-400">@{profile.username}</p>
            {profile.email && (
              <p className="text-xs text-zinc-500">{profile.email}</p>
            )}
            {profile.phone && (
              <p className="text-xs text-zinc-500">{profile.phone}</p>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-1.5">
          <span
            className={`rounded-full border px-2.5 py-0.5 text-xs ${badge.color}`}
          >
            {badge.label}
          </span>
          <BadgeRow badge={profile.badge} isAdmin={profile.is_admin} />

          {profile.is_blocked && (
            <span className="rounded-full border border-red-400/30 bg-red-400/10 px-2.5 py-0.5 text-xs text-red-300">
              Blocked
            </span>
          )}

          {isRestricted && (
            <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-0.5 text-xs text-amber-300">
              Restricted
            </span>
          )}
        </div>
      </div>

      {profile.id_card_url && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => void handleIdCardToggle()}
            className="text-sm text-amber-400 transition hover:text-amber-300"
          >
            {showIdCard ? 'Hide' : 'View'} ID Card
          </button>

          {showIdCard && (
            <div className="mt-2 overflow-hidden rounded-xl border border-amber-400/20">
              {idCardLoading && (
                <p className="p-3 text-sm text-zinc-400">
                  Loading ID card…
                </p>
              )}

              {idCardError && (
                <p className="p-3 text-sm text-red-300">{idCardError}</p>
              )}

              {idCardUrl && (
                <img
                  src={idCardUrl}
                  alt="ID Card"
                  className="max-h-64 w-full bg-black/40 object-contain"
                  onError={() => {
                    setIdCardUrl(null);
                    setIdCardError('Could not display the ID card.');
                  }}
                />
              )}
            </div>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {profile.verification_status !== 'verified' && (
          <button
            type="button"
            onClick={() => onVerify(profile.id, 'verified')}
            disabled={actionLoading === `verify-${profile.id}`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-green-500/30 bg-green-500/10 px-3 py-1.5 text-xs font-medium text-green-300 transition hover:bg-green-500/20 disabled:opacity-50"
          >
            {actionLoading === `verify-${profile.id}` ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <ShieldCheck size={14} />
            )}
            Approve
          </button>
        )}

        {profile.verification_status !== 'rejected' &&
          profile.verification_status !== 'unverified' && (
            <button
              type="button"
              onClick={() => onVerify(profile.id, 'rejected')}
              disabled={actionLoading === `verify-${profile.id}`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-1.5 text-xs font-medium text-red-300 transition hover:bg-red-400/20 disabled:opacity-50"
            >
              <ShieldX size={14} />
              Reject
            </button>
          )}

        {profile.is_blocked ? (
          <button
            type="button"
            onClick={() => onBlock(profile.id, false)}
            disabled={actionLoading === `block-${profile.id}`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-amber-400/20 bg-black/30 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-white/5 disabled:opacity-50"
          >
            <CheckCircle size={14} />
            Unblock
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onBlock(profile.id, true)}
            disabled={actionLoading === `block-${profile.id}`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-1.5 text-xs font-medium text-red-300 transition hover:bg-red-400/20 disabled:opacity-50"
          >
            <Ban size={14} />
            Block
          </button>
        )}

        <div className="relative">
          <button
            type="button"
            onClick={() => setShowRestrictMenu(!showRestrictMenu)}
            disabled={actionLoading === `restrict-${profile.id}`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-xs font-medium text-amber-300 transition hover:bg-amber-400/20 disabled:opacity-50"
          >
            {actionLoading === `restrict-${profile.id}` ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Clock size={14} />
            )}
            Restrict
          </button>

          {showRestrictMenu && (
            <div className="absolute z-10 mt-1 rounded-xl border border-amber-400/20 bg-[#0d0902] p-1 shadow-2xl">
              {[1, 3, 7, 30].map((days) => (
                <button
                  type="button"
                  key={days}
                  onClick={() => {
                    onRestrict(profile.id, days);
                    setShowRestrictMenu(false);
                  }}
                  className="block w-full whitespace-nowrap rounded-lg px-3 py-1.5 text-left text-xs text-zinc-300 transition hover:bg-white/5"
                >
                  {days} day{days > 1 ? 's' : ''}
                </button>
              ))}

              {isRestricted && (
                <button
                  type="button"
                  onClick={() => {
                    onRestrict(profile.id, 0);
                    setShowRestrictMenu(false);
                  }}
                  className="block w-full whitespace-nowrap rounded-lg px-3 py-1.5 text-left text-xs text-zinc-400 transition hover:bg-white/5"
                >
                  Lift restriction
                </button>
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => onSetAdmin(profile.id, !profile.is_admin)}
          disabled={actionLoading === `admin-${profile.id}`}
          className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
            profile.is_admin
              ? 'border-red-400/30 bg-red-400/10 text-red-300 hover:bg-red-400/20'
              : 'border-amber-400/20 bg-black/30 text-zinc-300 hover:bg-white/5'
          }`}
        >
          {actionLoading === `admin-${profile.id}` ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Shield size={14} />
          )}
          {profile.is_admin ? 'Remove Admin' : 'Make Admin'}
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => setShowBadgeMenu(!showBadgeMenu)}
            disabled={actionLoading === `badge-${profile.id}`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-xs font-medium text-amber-300 transition hover:bg-amber-400/20 disabled:opacity-50"
          >
            {actionLoading === `badge-${profile.id}` ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Award size={14} />
            )}
            Badge
          </button>

          {showBadgeMenu && (
            <div className="absolute z-10 mt-1 rounded-xl border border-amber-400/20 bg-[#0d0902] p-1 shadow-2xl">
              {(Object.keys(BADGE_META) as Exclude<AdminBadge, null>[]).map(
                (badgeValue) => (
                  <button
                    type="button"
                    key={badgeValue}
                    onClick={() => {
                      onSetBadge(profile.id, badgeValue);
                      setShowBadgeMenu(false);
                    }}
                    className={`flex w-full items-center gap-2 whitespace-nowrap rounded-lg px-3 py-1.5 text-left text-xs transition hover:bg-white/5 ${
                      profile.badge === badgeValue
                        ? 'text-amber-300'
                        : 'text-zinc-300'
                    }`}
                  >
                    {profile.badge === badgeValue && (
                      <CheckCircle size={12} />
                    )}
                    {BADGE_META[badgeValue].label}
                  </button>
                ),
              )}

              {profile.badge && (
                <button
                  type="button"
                  onClick={() => {
                    onSetBadge(profile.id, null);
                    setShowBadgeMenu(false);
                  }}
                  className="block w-full whitespace-nowrap rounded-lg px-3 py-1.5 text-left text-xs text-zinc-400 transition hover:bg-white/5"
                >
                  Remove badge
                </button>
              )}
            </div>
          )}
        </div>

        {!showDeleteConfirm ? (
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={actionLoading === `delete-${profile.id}`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-1.5 text-xs font-medium text-red-300 transition hover:bg-red-400/20 disabled:opacity-50"
          >
            <Trash2 size={14} />
            Delete
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onDelete(profile.id);
                setShowDeleteConfirm(false);
              }}
              disabled={actionLoading === `delete-${profile.id}`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
            >
              {actionLoading === `delete-${profile.id}` ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Trash2 size={14} />
              )}
              Confirm
            </button>

            <button
              type="button"
              onClick={() => setShowDeleteConfirm(false)}
              className="rounded-xl px-2 py-1.5 text-xs text-zinc-400 transition hover:text-white"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}