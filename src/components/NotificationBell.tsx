import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
} from '@/lib/notifications';
import { AppNotification, NotificationLinkType } from '@/types';
import Avatar from '@/components/Avatar';
import { BadgeRow } from '@/components/Badge';
import {
  Bell,
  MessageCircle,
  Users,
  MessageSquare,
  Heart,
  UserPlus,
  UserCheck,
  CheckCheck,
  Trash2,
  Loader2,
} from 'lucide-react';

interface NotificationBellProps {
  onNavigate: (
    linkType: NotificationLinkType,
    linkId: string | null,
    actorId: string | null
  ) => void;
}

const TYPE_ICON: Record<string, typeof Bell> = {
  message: MessageCircle,
  group_message: Users,
  comment: MessageSquare,
  reaction: Heart,
  friend_request: UserPlus,
  friend_accept: UserCheck,
};

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString();
}

export default function NotificationBell({
  onNavigate,
}: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try {
      const [list, count] = await Promise.all([
        getNotifications(30),
        getUnreadNotificationCount(),
      ]);

      setNotifications(list);
      setUnread(count);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    }
  }, []);

  useEffect(() => {
    refresh();

    const channel = supabase
      .channel('notifications-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
        },
        () => {
          refresh();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  useEffect(() => {
    if (!open) return;

    const handler = (e: MouseEvent) => {
      if (
        ref.current &&
        !ref.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handler);

    return () => {
      document.removeEventListener('mousedown', handler);
    };
  }, [open]);

  const handleOpen = async () => {
    const next = !open;
    setOpen(next);

    if (next && notifications.length === 0) {
      setLoading(true);
      await refresh();
      setLoading(false);
    }
  };

  const handleClick = async (n: AppNotification) => {
    if (!n.is_read) {
      try {
        await markNotificationRead(n.id);

        setNotifications((prev) =>
          prev.map((x) =>
            x.id === n.id ? { ...x, is_read: true } : x
          )
        );

        setUnread((u) => Math.max(0, u - 1));
      } catch {
        // Ignore errors
      }
    }

    setOpen(false);
    onNavigate(n.link_type, n.link_id, n.actor_id);
  };

  const handleMarkAll = async () => {
    setMarkingAll(true);

    try {
      await markAllNotificationsRead();
      setNotifications((prev) =>
        prev.map((x) => ({ ...x, is_read: true }))
      );
      setUnread(0);
    } catch {
      // Ignore errors
    }

    setMarkingAll(false);
  };

  const handleDelete = async (
    e: React.MouseEvent,
    id: string
  ) => {
    e.stopPropagation();

    try {
      await deleteNotification(id);

      setNotifications((prev) =>
        prev.filter((x) => x.id !== id)
      );

      setUnread((u) => Math.max(0, u - 1));
    } catch {
      // Ignore errors
    }
  };

  return (
    <div className="relative" ref={ref}>
      {/* Bell Button */}
      <button
        onClick={handleOpen}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-amber-500/20 bg-[#0c1126] text-amber-400/80 transition hover:border-amber-400/50 hover:bg-amber-500/10 hover:text-amber-200 active:scale-95"
        aria-label="Notifications"
      >
        <Bell size={18} />

        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-gradient-to-r from-amber-400 to-amber-600 px-1 text-[10px] font-extrabold text-slate-950 shadow-md">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {/* Notifications Dropdown Popup */}
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-amber-500/30 bg-[#0c1126]/95 text-amber-50 shadow-2xl backdrop-blur-xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-amber-500/20 bg-[#0a0f24] px-4 py-3">
            <h3 className="text-xs font-bold text-amber-200">
              Notifications
            </h3>

            {unread > 0 && (
              <button
                onClick={handleMarkAll}
                disabled={markingAll}
                className="flex items-center gap-1 text-[11px] font-semibold text-amber-300 transition hover:text-amber-100 disabled:opacity-50"
              >
                {markingAll ? (
                  <Loader2
                    size={12}
                    className="animate-spin text-amber-300"
                  />
                ) : (
                  <CheckCheck size={12} />
                )}
                Mark all read
              </button>
            )}
          </div>

          {/* List Content */}
          <div className="max-h-80 overflow-y-auto divide-y divide-amber-500/10">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2
                  size={20}
                  className="animate-spin text-amber-400"
                />
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-8 text-center">
                <Bell
                  size={24}
                  className="mx-auto mb-2 text-amber-500/30"
                />
                <p className="text-xs font-medium text-amber-400/50">
                  No notifications yet
                </p>
              </div>
            ) : (
              notifications.map((n) => {
                const Icon = TYPE_ICON[n.type] ?? Bell;

                return (
                  <button
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={`group flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-amber-500/10 ${
                      !n.is_read ? 'bg-amber-500/10' : ''
                    }`}
                  >
                    <div className="relative shrink-0">
                      <Avatar
                        name={n.actor_name ?? 'User'}
                        avatarUrl={n.actor_avatar_url}
                        size={8}
                      />

                      <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border border-amber-500/30 bg-[#0a0f24] text-amber-300">
                        <Icon size={10} />
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-xs leading-snug ${
                          !n.is_read
                            ? 'font-bold text-amber-100'
                            : 'font-medium text-amber-200/80'
                        }`}
                      >
                        {n.title}
                      </p>

                      {(n.actor_badge || n.actor_is_admin) && (
                        <div className="mt-0.5">
                          <BadgeRow
                            badge={n.actor_badge ?? null}
                            isAdmin={n.actor_is_admin ?? false}
                            size="xs"
                          />
                        </div>
                      )}

                      {n.body && (
                        <p className="mt-0.5 truncate text-[11px] text-amber-400/60">
                          {n.body}
                        </p>
                      )}

                      <p className="mt-1 text-[10px] font-medium text-amber-400/40">
                        {timeAgo(n.created_at)}
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-col items-center gap-1.5 pt-0.5">
                      {!n.is_read && (
                        <span className="h-2 w-2 rounded-full bg-amber-400 shadow-sm" />
                      )}

                      <span
                        onClick={(e) => handleDelete(e, n.id)}
                        className="rounded p-1 text-amber-400/40 opacity-0 transition hover:bg-rose-500/10 hover:text-rose-400 group-hover:opacity-100"
                        aria-label="Delete notification"
                      >
                        <Trash2 size={12} />
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}