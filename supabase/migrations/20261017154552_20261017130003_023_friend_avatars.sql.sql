/*
# Show avatars in friends lists and discover page

1. Modified Functions (all dropped and recreated to change their return types)
- `get_friend_requests()`: now also returns `requester_avatar_url` (text)
- `get_sent_requests()`: now also returns `addressee_avatar_url` (text)
- `get_friends()`: now also returns `friend_avatar_url` (text)
- `get_discover_users()`: now also returns `avatar_url` (text)

2. Security
- Same SECURITY DEFINER functions, same access rules. Only the public avatar_url column is added to outputs; email/phone/id_card_url remain excluded.

3. Important Notes
- Functions must be dropped before recreating because Postgres cannot change return types in place.
- No table data touched.
*/

DROP FUNCTION IF EXISTS public.get_friend_requests();
CREATE FUNCTION public.get_friend_requests()
RETURNS TABLE (
  requester_id uuid,
  requester_name text,
  requester_username text,
  requester_avatar_url text,
  created_at timestamptz
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
    f.requester_id,
    p.full_name,
    p.username,
    p.avatar_url,
    f.created_at
  FROM friendships f
  JOIN profiles p ON p.id = f.requester_id
  WHERE f.addressee_id = auth.uid()
    AND f.status = 'pending'
  ORDER BY f.created_at DESC;
END;
$$;

DROP FUNCTION IF EXISTS public.get_sent_requests();
CREATE FUNCTION public.get_sent_requests()
RETURNS TABLE (
  addressee_id uuid,
  addressee_name text,
  addressee_username text,
  addressee_avatar_url text,
  created_at timestamptz
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
    f.addressee_id,
    p.full_name,
    p.username,
    p.avatar_url,
    f.created_at
  FROM friendships f
  JOIN profiles p ON p.id = f.addressee_id
  WHERE f.requester_id = auth.uid()
    AND f.status = 'pending'
  ORDER BY f.created_at DESC;
END;
$$;

DROP FUNCTION IF EXISTS public.get_friends();
CREATE FUNCTION public.get_friends()
RETURNS TABLE (
  friend_id uuid,
  friend_name text,
  friend_username text,
  friend_avatar_url text,
  since timestamptz
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
    CASE WHEN f.requester_id = auth.uid() THEN f.addressee_id ELSE f.requester_id END AS friend_id,
    p.full_name AS friend_name,
    p.username AS friend_username,
    p.avatar_url AS friend_avatar_url,
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

DROP FUNCTION IF EXISTS public.get_discover_users();
CREATE FUNCTION public.get_discover_users()
RETURNS TABLE (
  user_id uuid,
  full_name text,
  username text,
  avatar_url text,
  friendship_status text
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
    p.id AS user_id,
    p.full_name,
    p.username,
    p.avatar_url,
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
      ),
      'none'
    ) AS friendship_status
  FROM profiles p
  WHERE p.id != auth.uid()
    AND p.verification_status = 'verified'
    AND p.is_blocked = false
  ORDER BY p.full_name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_friend_requests() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_sent_requests() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_friends() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_discover_users() TO authenticated;
