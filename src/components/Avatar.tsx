interface AvatarProps {
  name: string;
  avatarUrl?: string | null;
  size: number;
  className?: string;
}

const SIZES: Record<number, string> = {
  6: 'h-6 w-6 text-[10px]',
  7: 'h-7 w-7 text-xs',
  9: 'h-9 w-9 text-sm',
  10: 'h-10 w-10 text-sm',
  24: 'h-24 w-24 text-3xl',
};

export default function Avatar({ name, avatarUrl, size, className = '' }: AvatarProps) {
  const sizeClass = SIZES[size] ?? 'h-10 w-10 text-sm';

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={`${sizeClass} shrink-0 rounded-full object-cover border border-amber-400/30 ${className}`}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} flex shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-amber-600 to-amber-500 font-bold text-white shadow-md border border-amber-400/30 ${className}`}
    >
      {name?.charAt(0).toUpperCase() ?? 'U'}
    </div>
  );
}