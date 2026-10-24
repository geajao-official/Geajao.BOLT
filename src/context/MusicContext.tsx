import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import {
  fetchTracks,
  getCachedTracks,
  MusicTrack,
  MUSIC_CHANGED_EVENT,
  getSelectedTrackId,
  setSelectedTrackId,
} from '@/lib/backgroundMusic';
import MusicBar from '@/components/MusicBar';

interface MusicContextType {
  tracks: MusicTrack[];
  currentTrack: MusicTrack | null;
  isPlaying: boolean;
  selectTrack: (id: string | null) => void;
  togglePlay: () => void;
  hasMusic: boolean;
}

const MusicContext = createContext<MusicContextType | undefined>(undefined);

export function MusicProvider({ children }: { children: ReactNode }) {
  const [tracks, setTracks] = useState<MusicTrack[]>(() => getCachedTracks() ?? []);
  const [selectedId, setSelectedId] = useState<string | null>(() => getSelectedTrackId());
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    fetchTracks().then(setTracks);
    const onChange = () => {
      if (getCachedTracks() === undefined) {
        fetchTracks().then(setTracks);
      } else {
        setTracks(getCachedTracks() ?? []);
      }
    };
    window.addEventListener(MUSIC_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(MUSIC_CHANGED_EVENT, onChange);
  }, []);

  const currentTrack = tracks.find((t) => t.id === selectedId) ?? null;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      setIsPlaying(false);
      return;
    }
    if (currentTrack) {
      if (audio.src !== currentTrack.url) audio.src = currentTrack.url;
      audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    } else {
      audio.pause();
      audio.removeAttribute('src');
      setIsPlaying(false);
    }
  }, [currentTrack]);

  const selectTrack = (id: string | null) => {
    setSelectedId(id);
    setSelectedTrackId(id);
  };

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;
    if (audio.paused) {
      audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  };

  return (
    <MusicContext.Provider
      value={{
        tracks,
        currentTrack,
        isPlaying,
        selectTrack,
        togglePlay,
        hasMusic: tracks.length > 0,
      }}
    >
      <audio ref={audioRef} loop className="hidden" id="geajai-bg-music" />
      {children}
      <MusicBar />
    </MusicContext.Provider>
  );
}

export function useBackgroundMusic(): MusicContextType {
  const ctx = useContext(MusicContext);
  if (!ctx) throw new Error('useBackgroundMusic must be used within MusicProvider');
  return ctx;
}
