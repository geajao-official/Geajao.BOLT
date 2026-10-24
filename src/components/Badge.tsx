import { Shield, Award, Medal } from 'lucide-react';
import { BadgeType } from '@/types';

export const BADGE_META: Record<
  BadgeType,
  { label: string; icon: typeof Shield; classes: string }
> = {
  cadet: { label: 'Cadet', icon: Award, classes: 'bg-amber-400/15 text-amber-300 border-amber-400/30' },
  ex_cadet: { label: 'Ex-Cadet', icon: Medal, classes: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30' },
};

export const ADMIN_CHIP_META = {
  label: 'Admin',
  icon: Shield,
  classes: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
};

export default function Badge({ badge, size = 'sm' }: { badge: BadgeType | null | undefined; size?: 'sm' | 'xs' }) {
  if (!badge) return null;
  const meta = BADGE_META[badge];
  if (!meta) return null;
  const Icon = meta.icon;
  const sizeClasses = size === 'xs' ? 'px-1.5 py-0.5 text-[9px] gap-0.5' : 'px-2 py-0.5 text-[10px] gap-1';
  return (
    <span
      className={`inline-flex items-center rounded-full border font-semibold uppercase tracking-wide ${meta.classes} ${sizeClasses}`}
    >
      <Icon size={size === 'xs' ? 9 : 11} />
      {meta.label}
    </span>
  );
}

export function AdminChip({ isAdmin, size = 'sm' }: { isAdmin: boolean | null | undefined; size?: 'sm' | 'xs' }) {
  if (!isAdmin) return null;
  const { label, icon: Icon, classes } = ADMIN_CHIP_META;
  const sizeClasses = size === 'xs' ? 'px-1.5 py-0.5 text-[9px] gap-0.5' : 'px-2 py-0.5 text-[10px] gap-1';
  return (
    <span
      className={`inline-flex items-center rounded-full border font-semibold uppercase tracking-wide ${classes} ${sizeClasses}`}
    >
      <Icon size={size === 'xs' ? 9 : 11} />
      {label}
    </span>
  );
}

/** Renders the Admin chip (if applicable) next to the Cadet/Ex-Cadet badge (if any). */
export function BadgeRow({
  badge,
  isAdmin,
  size = 'sm',
  className = '',
}: {
  badge: BadgeType | null | undefined;
  isAdmin: boolean | null | undefined;
  size?: 'sm' | 'xs';
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <AdminChip isAdmin={isAdmin} size={size} />
      <Badge badge={badge} size={size} />
    </span>
  );
}