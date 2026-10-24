import { supabase } from '@/lib/supabase';
import { AppNotification } from '@/types';

export async function getNotifications(limit = 30): Promise<AppNotification[]> {
  const { data, error } = await supabase.rpc('get_notifications', { p_limit: limit });
  if (error) throw error;
  return ((data as any[]) || []).map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    link_id: n.link_id,
    link_type: n.link_type,
    is_read: n.is_read,
    created_at: n.created_at,
    actor_id: n.actor_id,
    actor_name: n.actor_name,
    actor_username: n.actor_username,
    actor_avatar_url: n.actor_avatar_url,
    actor_badge: n.actor_badge ?? null,
    actor_is_admin: n.actor_is_admin ?? false,
  }));
}

export async function getUnreadNotificationCount(): Promise<number> {
  const { data, error } = await supabase.rpc('get_unread_notification_count');
  if (error) throw error;
  return Number(data ?? 0);
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const { error } = await supabase.rpc('mark_notification_read', {
    p_notification_id: notificationId,
  });
  if (error) throw error;
}

export async function markAllNotificationsRead(): Promise<void> {
  const { error } = await supabase.rpc('mark_all_notifications_read');
  if (error) throw error;
}

export async function deleteNotification(notificationId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_notification', {
    p_notification_id: notificationId,
  });
  if (error) throw error;
}
