import { Play, Pause, X, Music } from 'lucide-react';
import { useBackgroundMusic } from '@/context/MusicContext';

export default function MusicBar() {
  const { currentTrack, isPlaying, togglePlay, selectTrack } = useBackgroundMusic();
  if (!currentTrack) return null;
  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-amber-400/20 bg-[#0d0902]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2.5">
          <span className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-400/30 bg-amber-400/10 text-amber-400 sm:flex shadow-[0_0_15px_rgba(212,175,55,0.15)]">
            <Music size={16} />
          </span>
          <button
            onClick={togglePlay}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-amber-600 to-amber-500 text-white shadow-lg shadow-amber-500/25 transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-amber-400"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-zinc-100">{currentTrack.title}</p>
            <p className="text-xs text-zinc-400">{isPlaying ? 'Now playing' : 'Paused'}</p>
          </div>
          <button
            onClick={() => selectTrack(null)}
            className="rounded-xl p-2 text-zinc-400 transition hover:bg-white/5 hover:text-white"
            aria-label="Stop"
          >
            <X size={18} />
          </button>
        </div>
      </div>
      <div className="h-14" aria-hidden />
    </>
  );
}