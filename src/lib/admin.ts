import { supabase } from '@/lib/supabase';
import type { AdminProfile } from '@/types';

type AdminAction =
  | 'verifyAdminPin'
  | 'moderatorGetProfiles'
  | 'adminGetAllProfiles'
  | 'adminGetIdCardSignedUrl'
  | 'adminUpdateVerification'
  | 'adminSetBlocked'
  | 'adminSetRestriction'
  | 'adminRemovePost'
  | 'adminGetAllPosts'
  | 'adminAddSlideshowPhoto'
  | 'adminRemoveSlideshowPhoto'
  | 'adminGetAllSlideshowPhotos'
  | 'adminDeleteUser'
  | 'adminSetSiteLogo'
  | 'adminGetSiteLogo'
  | 'adminSetTeamLogo'
  | 'adminGetTeamLogo'
  | 'adminSetMusic'
  | 'adminGetMusic'
  | 'adminAddMusicTrack'
  | 'adminDeleteMusicTrack'
  | 'adminListMusicTracks'
  | 'adminSetBadge'
  | 'adminSetAdmin'
  | 'adminSetModerator';

export type AdminBadge = 'cadet' | 'ex_cadet' | null;

export interface ModeratorProfile {
  id: string;
  username: string | null;
  full_name: string | null;
  badge: AdminBadge;
}

export interface AdminPost {
  id: string;
  user_id: string;
  content_type: string;
  text_content: string | null;
  media_url: string | null;
  is_removed: boolean;
  created_at: string;
  author_name: string;
  author_username: string;
  profiles?: {
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}

async function adminCall<T>(
  pin: string | undefined,
  action: AdminAction,
  fields: Record<string, unknown> = {},
): Promise<T> {
  const { data, error } = await supabase.functions.invoke<{ data: T }>(
    'admin-api',
    {
      body: {
        ...fields,
        action,
        ...(pin !== undefined ? { pin } : {}),
      },
    },
  );

  if (error) throw error;
  if (!data) throw new Error('No response from admin function');

  return data.data;
}

export async function verifyAdminPin(pin: string): Promise<boolean> {
  // Let transport/server errors throw so AdminPinPage can show a retry message.
  return adminCall<boolean>(pin, 'verifyAdminPin');
}

export async function moderatorGetProfiles(): Promise<ModeratorProfile[]> {
  return (
    (await adminCall<ModeratorProfile[] | null>(
      undefined,
      'moderatorGetProfiles',
    )) ?? []
  );
}

export async function moderatorSetBadge(
  userId: string,
  badge: AdminBadge,
): Promise<void> {
  await adminCall<null>(undefined, 'adminSetBadge', { userId, badge });
}

export async function adminGetAllProfiles(
  pin: string,
): Promise<AdminProfile[]> {
  return adminCall<AdminProfile[]>(pin, 'adminGetAllProfiles');
}

export async function adminGetIdCardSignedUrl(
  pin: string,
  userId: string,
): Promise<string> {
  return adminCall<string>(pin, 'adminGetIdCardSignedUrl', { userId });
}

export async function adminUpdateVerification(
  pin: string,
  userId: string,
  status: 'unverified' | 'pending' | 'verified' | 'rejected',
): Promise<void> {
  await adminCall<null>(pin, 'adminUpdateVerification', { userId, status });
}

export async function adminSetBlocked(
  pin: string,
  userId: string,
  blocked: boolean,
): Promise<void> {
  await adminCall<null>(pin, 'adminSetBlocked', { userId, blocked });
}

export async function adminSetRestriction(
  pin: string,
  userId: string,
  restrictUntil: string | null,
): Promise<void> {
  await adminCall<null>(pin, 'adminSetRestriction', {
    userId,
    restrictUntil,
  });
}

export async function adminRemovePost(
  pin: string,
  postId: string,
): Promise<void> {
  await adminCall<null>(pin, 'adminRemovePost', { postId });
}

export async function adminGetAllPosts(
  pin: string,
): Promise<AdminPost[]> {
  return (
    (await adminCall<AdminPost[] | null>(pin, 'adminGetAllPosts')) ?? []
  );
}

export async function adminAddSlideshowPhoto(
  pin: string,
  photoUrl: string,
  displayOrder = 0,
): Promise<string> {
  return adminCall<string>(pin, 'adminAddSlideshowPhoto', {
    photoUrl,
    displayOrder,
  });
}

export async function adminRemoveSlideshowPhoto(
  pin: string,
  photoId: string,
): Promise<void> {
  await adminCall<null>(pin, 'adminRemoveSlideshowPhoto', { photoId });
}

export async function adminGetAllSlideshowPhotos(
  pin: string,
): Promise<unknown[]> {
  return adminCall<unknown[]>(pin, 'adminGetAllSlideshowPhotos');
}

export async function adminDeleteUser(
  pin: string,
  userId: string,
): Promise<void> {
  await adminCall<null>(pin, 'adminDeleteUser', { userId });
}

export async function adminSetSiteLogo(
  pin: string,
  logoUrl: string | null,
): Promise<void> {
  await adminCall<null>(pin, 'adminSetSiteLogo', { logoUrl });
}

export async function adminGetSiteLogo(
  pin: string,
): Promise<string | null> {
  return (await adminCall<string | null>(pin, 'adminGetSiteLogo')) ?? null;
}

export async function adminSetTeamLogo(
  pin: string,
  logoUrl: string | null,
): Promise<void> {
  await adminCall<null>(pin, 'adminSetTeamLogo', { logoUrl });
}

export async function adminGetTeamLogo(
  pin: string,
): Promise<string | null> {
  return (await adminCall<string | null>(pin, 'adminGetTeamLogo')) ?? null;
}

export async function adminSetMusic(
  pin: string,
  musicUrl: string | null,
): Promise<void> {
  await adminCall<null>(pin, 'adminSetMusic', { musicUrl });
}

export async function adminGetMusic(
  pin: string,
): Promise<string | null> {
  return (await adminCall<string | null>(pin, 'adminGetMusic')) ?? null;
}

export async function adminAddMusicTrack(
  pin: string,
  title: string,
  url: string,
): Promise<string> {
  return adminCall<string>(pin, 'adminAddMusicTrack', { title, url });
}

export async function adminDeleteMusicTrack(
  pin: string,
  trackId: string,
): Promise<void> {
  await adminCall<null>(pin, 'adminDeleteMusicTrack', { trackId });
}

export interface AdminMusicTrack {
  id: string;
  title: string;
  url: string;
  created_at: string;
}

export async function adminListMusicTracks(
  pin: string,
): Promise<AdminMusicTrack[]> {
  return (
    (await adminCall<AdminMusicTrack[]>(
      pin,
      'adminListMusicTracks',
    )) ?? []
  );
}

export async function adminSetBadge(
  pin: string,
  userId: string,
  badge: AdminBadge,
): Promise<void> {
  await adminCall<null>(pin, 'adminSetBadge', { userId, badge });
}

export async function adminSetAdmin(
  pin: string,
  userId: string,
  isAdmin: boolean,
): Promise<void> {
  await adminCall<null>(pin, 'adminSetAdmin', { userId, isAdmin });
}