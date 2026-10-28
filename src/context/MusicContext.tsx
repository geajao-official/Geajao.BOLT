
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from 'react';

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
  const [tracks, setTracks] = useState<MusicTrack[]>(
    () => getCachedTracks() ?? []
  );

  const [selectedId, setSelectedId] = useState<string | null>(
    () => getSelectedTrackId()
  );

  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Load track metadata, but do not load the audio files.
  useEffect(() => {
    let cancelled = false;

    const loadTracks = async () => {
      try {
        const result = await fetchTracks();
        if (!cancelled) {
          setTracks(result);
        }
      } catch (error) {
        console.error('Failed to load background music tracks:', error);
      }
    };

    void loadTracks();

    const onChange = () => {
      const cachedTracks = getCachedTracks();

      if (cachedTracks !== undefined) {
        setTracks(cachedTracks);
      } else {
        void loadTracks();
      }
    };

    window.addEventListener(MUSIC_CHANGED_EVENT, onChange);

    return () => {
      cancelled = true;
      window.removeEventListener(MUSIC_CHANGED_EVENT, onChange);
    };
  }, []);

  const currentTrack =
    tracks.find((track) => track.id === selectedId) ?? null;

  // Selecting a track must not start downloading or playing it.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    setIsPlaying(false);
  }, [currentTrack]);

  const selectTrack = (id: string | null) => {
    setSelectedId(id);
    setSelectedTrackId(id);
  };

  // Audio is loaded only after the user explicitly presses Play.
  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    if (!audio.paused) {
      audio.pause();
      setIsPlaying(false);
      return;
    }

    try {
      if (audio.src !== currentTrack.url) {
        audio.src = currentTrack.url;
        audio.load();
      }

      await audio.play();
      setIsPlaying(true);
    } catch (error) {
      setIsPlaying(false);
      console.error('Unable to play background music:', error);
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
      <audio
        ref={audioRef}
        loop
        preload="none"
        className="hidden"
        id="geajai-bg-music"
      />

      {children}
      <MusicBar />
    </MusicContext.Provider>
  );
}

export function useBackgroundMusic(): MusicContextType {
  const ctx = useContext(MusicContext);

  if (!ctx) {
    throw new Error('useBackgroundMusic must be used within MusicProvider');
  }

  return ctx;
}
