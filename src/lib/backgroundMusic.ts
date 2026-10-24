import { supabase } from '@/lib/supabase';

export const MUSIC_CHANGED_EVENT = 'geajai-music-changed';

export interface MusicTrack {
  id: string;
  title: string;
  url: string;
  created_at: string;
}

let cachedTracks: MusicTrack[] | undefined = undefined;

export function getCachedTracks(): MusicTrack[] | undefined {
  return cachedTracks;
}

export function setCachedTracks(tracks: MusicTrack[]) {
  cachedTracks = tracks;
}

export async function fetchTracks(): Promise<MusicTrack[]> {
  const { data, error } = await supabase.rpc('get_music_tracks');
  if (error) return cachedTracks ?? [];
  const value = (data as MusicTrack[]) ?? [];
  cachedTracks = value;
  return value;
}

export function invalidateMusicCache() {
  cachedTracks = undefined;
  try {
    window.dispatchEvent(new Event(MUSIC_CHANGED_EVENT));
  } catch {
    // ignore (SSR safety)
  }
}

const SELECTED_KEY = 'geajai-selected-track';

export function getSelectedTrackId(): string | null {
  try {
    return localStorage.getItem(SELECTED_KEY);
  } catch {
    return null;
  }
}

export function setSelectedTrackId(id: string | null) {
  try {
    if (id) localStorage.setItem(SELECTED_KEY, id);
    else localStorage.removeItem(SELECTED_KEY);
  } catch {
    // ignore
  }
}
