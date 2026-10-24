import { useState } from 'react';
import { useSiteLogo } from '@/lib/siteSettings';

interface LogoProps {
  className?: string;
  imgClassName?: string;
}

/**
 * Renders the custom site logo if the admin uploaded one, otherwise the
 * "Geajao" text brand. A custom logo is shown in a circular badge with
 * a ring and a smooth hover lift.
 */
export default function Logo({ className = '', imgClassName = '' }: LogoProps) {
  const logoUrl = useSiteLogo();
  const [loaded, setLoaded] = useState(false);

  if (logoUrl) {
    return (
      <span
        className={`group/logo relative inline-flex items-center justify-center overflow-hidden rounded-full border border-amber-400/30 bg-black shadow-lg shadow-black/30 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-amber-400/70 hover:shadow-xl hover:shadow-amber-500/20 ${className}`}
      >
        {/* soft ambient glow that brightens on hover */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full bg-amber-400/20 opacity-0 blur-md transition-opacity duration-300 group-hover/logo:opacity-100"
        />
        {/* shine sweep on hover */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-tr from-transparent via-amber-200/25 to-transparent opacity-0 transition-opacity duration-300 group-hover/logo:opacity-100"
        />
        <img
          src={logoUrl}
          alt="Geajao"
          onLoad={() => setLoaded(true)}
          className={`relative h-full w-full object-contain transition-all duration-700 ease-out ${
            imgClassName
          } ${loaded ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}
        />
      </span>
    );
  }

  return <span className={className}>Geajao</span>;
}