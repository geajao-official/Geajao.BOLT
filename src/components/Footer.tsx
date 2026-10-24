import { useState } from 'react';
import { useSiteLogo, useTeamLogo } from '@/lib/siteSettings';

export default function Footer({ pinned = false }: { pinned?: boolean }) {
  const siteLogo = useSiteLogo();
  const teamLogo = useTeamLogo();
  const [loaded, setLoaded] = useState(false);

  if (pinned) {
    return (
      <footer className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-ink-950/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-2 px-4 py-3 text-center">
          <p className="text-xs text-zinc-300">
            Specially Dedicated to{' '}
            <span className="font-bold text-white">50th-CCR</span>
            {' '}and Dedicated to{' '}
            <span className="font-bold text-white">2024 Batch-CC</span>
          </p>
          <div className="flex items-center gap-4 text-[11px] text-zinc-500">
            <span className="flex items-center gap-1.5">
              {teamLogo && (
                <span className="inline-flex h-5 w-5 overflow-hidden rounded-full border border-white/15">
                  <img src={teamLogo} alt="Team" className="h-full w-full object-cover" />
                </span>
              )}
              {siteLogo ? (
                <span className="inline-flex h-4 w-4 overflow-hidden rounded-full border border-white/10 bg-black">
                  <img src={siteLogo} alt="Geajao" className="h-full w-full object-contain" />
                </span>
              ) : null}
              <span>© 2026 Geajao · A Mukhosh Initiative</span>
            </span>
            <span className="h-3 w-px bg-ink-700" />
            <span className="transition hover:text-zinc-300">Community</span>
            <span className="h-3 w-px bg-ink-700" />
            <span className="transition hover:text-zinc-300">Safety</span>
            <span className="h-3 w-px bg-ink-700" />
            <span className="transition hover:text-zinc-300">Support</span>
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer className="mt-12 border-t border-ink-700 bg-ink-900/60">
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-5 px-4 py-8 sm:flex-row sm:justify-between">
        {/* Team logo badge */}
        <div className="flex items-center gap-3">
          {teamLogo ? (
            <span className="group/team relative inline-flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-ink-850 shadow-lg shadow-black/30 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-xl hover:shadow-accent/25">
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-full bg-accent/20 opacity-0 blur-md transition-opacity duration-300 group-hover/team:opacity-100"
              />
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-tr from-transparent via-white/25 to-transparent opacity-0 transition-opacity duration-300 group-hover/team:opacity-100"
              />
              <img
                src={teamLogo}
                alt="Team"
                onLoad={() => setLoaded(true)}
                className={`relative h-full w-full object-cover transition-all duration-700 ease-out ${
                  loaded ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
                }`}
              />
            </span>
          ) : (
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-dashed border-ink-600 text-[10px] font-medium uppercase tracking-wider text-zinc-600">
              Team
            </span>
          )}
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
              {siteLogo ? (
                <span className="inline-flex h-6 w-6 overflow-hidden rounded-full border border-white/10 bg-black align-middle">
                  <img src={siteLogo} alt="Geajao" className="h-full w-full object-contain" />
                </span>
              ) : (
                'Geajao'
              )}
              <span className="font-normal text-zinc-500">· A Mukhosh Initiative</span>
            </p>
            <p className="mt-0.5 text-xs text-zinc-600">
              © 2026 Geajao. All rights reserved.
            </p>
          </div>
        </div>

        {/* Links */}
        <nav className="flex items-center gap-4 text-xs text-zinc-500">
          <span className="transition hover:text-zinc-300">Community</span>
          <span className="h-3 w-px bg-ink-700" />
          <span className="transition hover:text-zinc-300">Safety</span>
          <span className="h-3 w-px bg-ink-700" />
          <span className="transition hover:text-zinc-300">Support</span>
        </nav>
      </div>

      {/* Dedication */}
      <div className="border-t border-ink-800 py-6 text-center">
        <p className="text-sm text-zinc-400">
          Specially Dedicated to{' '}
          <span className="font-bold text-zinc-200">50th-CCR</span>
        </p>
        <p className="mt-1 text-sm text-zinc-400">
          and Dedicated to{' '}
          <span className="font-bold text-zinc-200">2024 Batch-CC</span>
        </p>
      </div>
    </footer>
  );
}
