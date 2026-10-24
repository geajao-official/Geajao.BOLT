/*
  # Expose badge + is_admin everywhere a user name is shown

  Recreates (return shape changes) these SECURITY DEFINER functions so the UI can render an Admin
  chip and Cadet/Ex-Cadet badge next to every name, not just in the feed:

  - get_friend_requests()  -> + requester_badge, requester_is_admin
  - get_sent_requests()    -> + addressee_badge, addressee_is_admin
  - get_friends()          -> + friend_badge, friend_is_admin
  - get_user_friends()     -> + friend_badge, friend_is_admin  (same shape as get_friends)
  - get_discover_users()   -> + badge, is_admin
  - get_conversations()    -> + friend_badge, friend_is_admin
  - get_notifications(int) -> + actor_badge, actor_is_admin

  No table changes; badge and is_admin already exist on profiles (migration 035). Access rules are
  unchanged. Functions are dropped first because Postgres cannot change a return type in place.
*/

-- get_friend_requests
DROP FUNCTION IF EXISTS public.get_friend_requests();
CREATE FUNCTION public.get_friend_requests()
RETURNS TABLE (
  requester_id uuid,
  requester_name text,
  requester_username text,
  requester_avatar_url text,
  requester_badge text,
  requester_is_admin boolean,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  RETURN QUERY
    SELECT f.requester_id, p.full_name, p.username, p.avatar_url, p.badge, p.is_admin, f.created_at
    FROM friendships f JOIN profiles p ON p.id = f.requester_id
    WHERE f.addressee_id = auth.uid() AND f.status = 'pending'
    ORDER BY f.created_at DESC;
END;
$$;

-- get_sent_requests
DROP FUNCTION IF EXISTS public.get_sent_requests();
CREATE FUNCTION public.get_sent_requests()
RETURNS TABLE (
  addressee_id uuid,
  addressee_name text,
  addressee_username text,
  addressee_avatar_url text,
  addressee_badge text,
  addressee_is_admin boolean,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  RETURN QUERY
    SELECT f.addressee_id, p.full_name, p.username, p.avatar_url, p.badge, p.is_admin, f.created_at
    FROM friendships f JOIN profiles p ON p.id = f.addressee_id
    WHERE f.requester_id = auth.uid() AND f.status = 'pending'
    ORDER BY f.created_at DESC;
END;
$$;

-- get_friends
DROP FUNCTION IF EXISTS public.get_friends();
CREATE FUNCTION public.get_friends()
RETURNS TABLE (
  friend_id uuid,
  friend_name text,
  friend_username text,
  friend_avatar_url text,
  friend_badge text,
  friend_is_admin boolean,
  since timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  RETURN QUERY
    SELECT
      CASE WHEN f.requester_id = auth.uid() THEN f.addressee_id ELSE f.requester_id END AS friend_id,
      p.full_name AS friend_name,
      p.username AS friend_username,
      p.avatar_url AS friend_avatar_url,
      p.badge AS friend_badge,
      p.is_admin AS friend_is_admin,
      f.updated_at AS since
    FROM friendships f
    JOIN profiles p ON p.id = (
      CASE WHEN f.requester_id = auth.uid() THEN f.addressee_id ELSE f.requester_id END
    )
    WHERE (f.requester_id = auth.uid() OR f.addressee_id = auth.uid())
      AND f.status = 'accepted'
    ORDER BY p.full_name;
END;
$$;

-- get_user_friends (public friend list on a profile)
DROP FUNCTION IF EXISTS public.get_user_friends(uuid);
CREATE FUNCTION public.get_user_friends(p_user_id uuid)
RETURNS TABLE (
  friend_id uuid,
  friend_name text,
  friend_username text,
  friend_avatar_url text,
  friend_badge text,
  friend_is_admin boolean,
  since timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  RETURN QUERY
    SELECT
      CASE WHEN f.requester_id = p_user_id THEN f.addressee_id ELSE f.requester_id END AS friend_id,
      p.full_name AS friend_name,
      p.username AS friend_username,
      p.avatar_url AS friend_avatar_url,
      p.badge AS friend_badge,
      p.is_admin AS friend_is_admin,
      f.updated_at AS since
    FROM friendships f
    JOIN profiles p ON p.id = (
      CASE WHEN f.requester_id = p_user_id THEN f.addressee_id ELSE f.requester_id END
    )
    WHERE (f.requester_id = p_user_id OR f.addressee_id = p_user_id)
      AND f.status = 'accepted'
    ORDER BY p.full_name;
END;
$$;

-- get_discover_users
DROP FUNCTION IF EXISTS public.get_discover_users();
CREATE FUNCTION public.get_discover_users()
RETURNS TABLE (
  user_id uuid,
  full_name text,
  username text,
  avatar_url text,
  badge text,
  is_admin boolean,
  friendship_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  RETURN QUERY
    SELECT
      p.id AS user_id, p.full_name, p.username, p.avatar_url, p.badge, p.is_admin,
      COALESCE(
        (SELECT
          CASE
            WHEN f.requester_id = auth.uid() THEN f.status::text || '_outgoing'
            WHEN f.addressee_id = auth.uid() THEN f.status::text || '_incoming'
            ELSE f.status::text
          END
         FROM friendships f
         WHERE (f.requester_id = auth.uid() AND f.addressee_id = p.id)
            OR (f.requester_id = p.id AND f.addressee_id = auth.uid())
         LIMIT 1
        ), 'none'
      ) AS friendship_status
    FROM profiles p
    WHERE p.id != auth.uid()
      AND p.verification_status = 'verified'
      AND p.is_blocked = false
    ORDER BY p.full_name;
END;
$$;

-- get_conversations
DROP FUNCTION IF EXISTS public.get_conversations();
CREATE FUNCTION public.get_conversations()
RETURNS TABLE (
  conversation_id uuid,
  friend_id uuid,
  friend_name text,
  friend_username text,
  friend_avatar_url text,
  friend_badge text,
  friend_is_admin boolean,
  last_message text,
  last_message_at timestamptz,
  unread_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  RETURN QUERY
    SELECT
      c.id AS conversation_id,
      CASE WHEN c.user1_id = auth.uid() THEN c.user2_id ELSE c.user1_id END AS friend_id,
      p.full_name AS friend_name,
      p.username AS friend_username,
      p.avatar_url AS friend_avatar_url,
      p.badge AS friend_badge,
      p.is_admin AS friend_is_admin,
      (SELECT m.content FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_message,
      (SELECT m.created_at FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_message_at,
      (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.sender_id != auth.uid() AND m.read_at IS NULL) AS unread_count
    FROM conversations c
    JOIN profiles p ON p.id = (
      CASE WHEN c.user1_id = auth.uid() THEN c.user2_id ELSE c.user1_id END
    )
    WHERE c.user1_id = auth.uid() OR c.user2_id = auth.uid()
    ORDER BY last_message_at DESC NULLS LAST;
END;
$$;

-- get_notifications
DROP FUNCTION IF EXISTS public.get_notifications(int);
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
  actor_avatar_url text,
  actor_badge text,
  actor_is_admin boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  RETURN QUERY
    SELECT
      n.id, n.type, n.title, n.body, n.link_id, n.link_type, n.is_read, n.created_at,
      n.actor_id, p.full_name AS actor_name, p.username AS actor_username,
      p.avatar_url AS actor_avatar_url, p.badge AS actor_badge, p.is_admin AS actor_is_admin
    FROM notifications n
    LEFT JOIN profiles p ON p.id = n.actor_id
    WHERE n.recipient_id = auth.uid()
    ORDER BY n.created_at DESC
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 30), 1), 100);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_friend_requests() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_sent_requests() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_friends() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_friends(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_discover_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_conversations() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_notifications(int) TO authenticated;
