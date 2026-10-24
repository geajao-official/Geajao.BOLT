/*
# Notifications system (messages + posts + friends)

## Purpose
Adds a single `notifications` table that records events for a recipient user, and
database triggers that automatically create notification rows when:
  1. A new direct message is sent to them (1:1 chat).
  2. A new group chat message is sent in a group they belong to (not from them).
  3. Someone comments on their post.
  4. Someone reacts to their post.
  5. They receive a new friend request.
  6. A friend request they sent is accepted.

The frontend reads these via a SECURITY DEFINER function and marks them read/deleted
through simple RPCs. A live dropdown in the header shows the latest notifications with
an unread badge.

## New Tables
- `notifications`
  - `id` (uuid, PK)
  - `recipient_id` (uuid, FK -> auth.users, cascade) — who receives the notification
  - `actor_id` (uuid, FK -> auth.users, cascade, nullable) — who caused it
  - `type` (text) — one of: message, group_message, comment, reaction, friend_request, friend_accept
  - `title` (text) — pre-rendered headline ("Jane sent you a message")
  - `body` (text, nullable) — preview text (the message/comment snippet)
  - `link_id` (uuid, nullable) — conversation_id / group_id / post_id depending on type
  - `link_type` (text, nullable) — 'conversation' | 'group' | 'post' | 'profile'
  - `is_read` (boolean, default false)
  - `created_at` (timestamptz, default now())

## New Functions (SECURITY DEFINER)
- `get_notifications(p_limit int)` — returns the caller's newest notifications joined with
  actor profile info (name, username, avatar), newest first.
- `mark_notification_read(p_notification_id uuid)` — marks one notification read.
- `mark_all_notifications_read()` — marks all of the caller's notifications read.
- `delete_notification(p_notification_id uuid)` — deletes one notification owned by caller.
- `get_unread_notification_count()` — returns the caller's unread count.

## Triggers
- `on_message_insert_notify` — after insert on `messages`, notifies the non-sender participant.
- `on_group_message_insert_notify` — after insert on `chat_group_messages`, notifies every
  other member of the group (one row each).
- `on_post_comment_insert_notify` — after insert on `post_comments`, notifies the post owner.
- `on_post_reaction_insert_notify` — after insert on `post_reactions`, notifies the post owner.
- `on_friendship_insert_notify` — after insert on `friendships`, notifies the addressee.
- `on_friendship_update_notify` — after update on `friendships`, when status becomes accepted,
  notifies the requester that their request was accepted.

All triggers skip self-notifications (you never get notified about your own action).

## Security
- RLS enabled on `notifications`. The recipient owns their notifications: full CRUD scoped to
  `recipient_id = auth.uid()`.
- Trigger functions run as SECURITY DEFINER so they can insert rows on behalf of any user
  without being blocked by RLS.
- All RPC functions are `TO authenticated` only.

## Important Notes
1. Notifications are best-effort: if a trigger fails it must not break the parent insert, so
   every trigger body is wrapped so exceptions are swallowed (the parent operation still succeeds).
2. Existing rows in `messages`, `post_comments`, `post_reactions`, `friendships` are NOT
   backfilled — notifications only start from the moment the triggers are installed.
3. `link_id` + `link_type` let the frontend navigate the user to the right screen when tapped.
*/

-- ============================================
-- notifications table
-- ============================================

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  link_id uuid,
  link_type text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread
  ON notifications(recipient_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created
  ON notifications(recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_created
  ON notifications(created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_notifications" ON notifications;
CREATE POLICY "select_own_notifications"
  ON notifications FOR SELECT TO authenticated
  USING (auth.uid() = recipient_id);

DROP POLICY IF EXISTS "insert_own_notifications" ON notifications;
CREATE POLICY "insert_own_notifications"
  ON notifications FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = recipient_id);

DROP POLICY IF EXISTS "update_own_notifications" ON notifications;
CREATE POLICY "update_own_notifications"
  ON notifications FOR UPDATE TO authenticated
  USING (auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = recipient_id);

DROP POLICY IF EXISTS "delete_own_notifications" ON notifications;
CREATE POLICY "delete_own_notifications"
  ON notifications FOR DELETE TO authenticated
  USING (auth.uid() = recipient_id);

-- ============================================
-- Helper: safe insert (swallows errors so parent op never fails)
-- ============================================

CREATE OR REPLACE FUNCTION public.notify_insert(
  p_recipient uuid,
  p_actor uuid,
  p_type text,
  p_title text,
  p_body text DEFAULT NULL,
  p_link_id uuid DEFAULT NULL,
  p_link_type text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_recipient IS NULL THEN RETURN; END IF;
  IF p_actor IS NOT NULL AND p_actor = p_recipient THEN RETURN; END IF; -- skip self
  INSERT INTO notifications (recipient_id, actor_id, type, title, body, link_id, link_type)
  VALUES (p_recipient, p_actor, p_type, p_title, p_body, p_link_id, p_link_type);
EXCEPTION WHEN OTHERS THEN
  -- never let a notification failure break the parent operation
  RETURN;
END;
$$;

-- ============================================
-- Direct message trigger
-- ============================================

CREATE OR REPLACE FUNCTION public.trg_notify_on_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recipient uuid;
  v_sender_name text;
  v_conversation_id uuid;
BEGIN
  SELECT CASE WHEN c.user1_id = NEW.sender_id THEN c.user2_id ELSE c.user1_id END
    INTO v_recipient
  FROM conversations c WHERE c.id = NEW.conversation_id LIMIT 1;

  IF v_recipient IS NULL OR v_recipient = NEW.sender_id THEN RETURN NEW; END IF;

  SELECT p.full_name INTO v_sender_name FROM profiles p WHERE p.id = NEW.sender_id LIMIT 1;

  PERFORM public.notify_insert(
    v_recipient,
    NEW.sender_id,
    'message',
    COALESCE(v_sender_name, 'Someone') || ' sent you a message',
    left(NEW.content, 120),
    NEW.conversation_id,
    'conversation'
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_message_insert_notify ON messages;
CREATE TRIGGER on_message_insert_notify
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_on_message();

-- ============================================
-- Group message trigger (notify every other member)
-- ============================================

CREATE OR REPLACE FUNCTION public.trg_notify_on_group_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member uuid;
  v_sender_name text;
  v_group_name text;
BEGIN
  SELECT p.full_name INTO v_sender_name FROM profiles p WHERE p.id = NEW.sender_id LIMIT 1;
  SELECT g.name INTO v_group_name FROM chat_groups g WHERE g.id = NEW.group_id LIMIT 1;

  FOR v_member IN
    SELECT m.user_id FROM chat_group_members m
    WHERE m.group_id = NEW.group_id AND m.user_id <> NEW.sender_id
  LOOP
    PERFORM public.notify_insert(
      v_member,
      NEW.sender_id,
      'group_message',
      COALESCE(v_sender_name, 'Someone') || ' messaged ' || COALESCE(v_group_name, 'your group'),
      left(NEW.content, 120),
      NEW.group_id,
      'group'
    );
  END LOOP;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_group_message_insert_notify ON chat_group_messages;
CREATE TRIGGER on_group_message_insert_notify
  AFTER INSERT ON chat_group_messages
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_on_group_message();

-- ============================================
-- Post comment trigger
-- ============================================

CREATE OR REPLACE FUNCTION public.trg_notify_on_post_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post_owner uuid;
  v_author_name text;
BEGIN
  SELECT p.user_id INTO v_post_owner FROM posts p WHERE p.id = NEW.post_id LIMIT 1;
  IF v_post_owner IS NULL OR v_post_owner = NEW.user_id THEN RETURN NEW; END IF;

  SELECT pr.full_name INTO v_author_name FROM profiles pr WHERE pr.id = NEW.user_id LIMIT 1;

  PERFORM public.notify_insert(
    v_post_owner,
    NEW.user_id,
    'comment',
    COALESCE(v_author_name, 'Someone') || ' commented on your post',
    left(NEW.content, 120),
    NEW.post_id,
    'post'
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_post_comment_insert_notify ON post_comments;
CREATE TRIGGER on_post_comment_insert_notify
  AFTER INSERT ON post_comments
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_on_post_comment();

-- ============================================
-- Post reaction trigger
-- ============================================

CREATE OR REPLACE FUNCTION public.trg_notify_on_post_reaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post_owner uuid;
  v_reactor_name text;
  v_reaction text;
BEGIN
  SELECT p.user_id INTO v_post_owner FROM posts p WHERE p.id = NEW.post_id LIMIT 1;
  IF v_post_owner IS NULL OR v_post_owner = NEW.user_id THEN RETURN NEW; END IF;

  SELECT pr.full_name INTO v_reactor_name FROM profiles pr WHERE pr.id = NEW.user_id LIMIT 1;
  v_reaction := COALESCE(NEW.reaction::text, 'reacted');

  PERFORM public.notify_insert(
    v_post_owner,
    NEW.user_id,
    'reaction',
    COALESCE(v_reactor_name, 'Someone') || ' reacted to your post',
    v_reaction,
    NEW.post_id,
    'post'
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_post_reaction_insert_notify ON post_reactions;
CREATE TRIGGER on_post_reaction_insert_notify
  AFTER INSERT ON post_reactions
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_on_post_reaction();

-- ============================================
-- Friend request trigger (insert)
-- ============================================

CREATE OR REPLACE FUNCTION public.trg_notify_on_friendship_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requester_name text;
BEGIN
  IF NEW.status <> 'pending' THEN RETURN NEW; END IF;
  IF NEW.requester_id = NEW.addressee_id THEN RETURN NEW; END IF;

  SELECT p.full_name INTO v_requester_name FROM profiles p WHERE p.id = NEW.requester_id LIMIT 1;

  PERFORM public.notify_insert(
    NEW.addressee_id,
    NEW.requester_id,
    'friend_request',
    COALESCE(v_requester_name, 'Someone') || ' sent you a friend request',
    NULL,
    NEW.requester_id,
    'profile'
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_friendship_insert_notify ON friendships;
CREATE TRIGGER on_friendship_insert_notify
  AFTER INSERT ON friendships
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_on_friendship_insert();

-- ============================================
-- Friend accept trigger (update)
-- ============================================

CREATE OR REPLACE FUNCTION public.trg_notify_on_friendship_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_accepter_name text;
BEGIN
  IF OLD.status <> 'pending' OR NEW.status <> 'accepted' THEN RETURN NEW; END IF;
  IF NEW.requester_id = NEW.addressee_id THEN RETURN NEW; END IF;

  SELECT p.full_name INTO v_accepter_name FROM profiles p WHERE p.id = NEW.addressee_id LIMIT 1;

  PERFORM public.notify_insert(
    NEW.requester_id,
    NEW.addressee_id,
    'friend_accept',
    COALESCE(v_accepter_name, 'Someone') || ' accepted your friend request',
    NULL,
    NEW.addressee_id,
    'profile'
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_friendship_update_notify ON friendships;
CREATE TRIGGER on_friendship_update_notify
  AFTER UPDATE ON friendships
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_on_friendship_update();

-- ============================================
-- Read functions
-- ============================================

CREATE OR REPLACE FUNCTION public.get_notifications(p_limit int DEFAULT 30)
RETURNS TABLE (
  id uuid,
  type text,
  title text,
  body text,
  link_id uuid,
  link_type text,
  is_read boolean,
  created_at timestamptz,
  actor_id uuid,
  actor_name text,
  actor_username text,
  actor_avatar_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  SELECT
    n.id,
    n.type,
    n.title,
    n.body,
    n.link_id,
    n.link_type,
    n.is_read,
    n.created_at,
    n.actor_id,
    p.full_name AS actor_name,
    p.username AS actor_username,
    p.avatar_url AS actor_avatar_url
  FROM notifications n
  LEFT JOIN profiles p ON p.id = n.actor_id
  WHERE n.recipient_id = auth.uid()
  ORDER BY n.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 30), 1), 100);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_unread_notification_count()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  RETURN (
    SELECT count(*) FROM notifications
    WHERE recipient_id = auth.uid() AND is_read = false
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_notification_read(p_notification_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  UPDATE notifications SET is_read = true
  WHERE id = p_notification_id AND recipient_id = auth.uid() AND is_read = false;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  UPDATE notifications SET is_read = true
  WHERE recipient_id = auth.uid() AND is_read = false;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_notification(p_notification_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  DELETE FROM notifications
  WHERE id = p_notification_id AND recipient_id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_notifications(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_unread_notification_count() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_notification_read(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read() TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_notification(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.notify_insert(uuid, uuid, text, text, text, uuid, text) TO authenticated;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
