/*
# Expose avatar URLs in public profile helpers (re-run)

1. Modified Functions
- `get_public_profile(p_user_id)`: dropped and recreated, now also returns `avatar_url` (text) so other users can see each other's profile picture.
- `get_user_friends(p_user_id)`: dropped and recreated, now also returns `friend_avatar_url` (text) so friends lists can show profile pictures.

2. Security
- Same SECURITY DEFINER functions. avatar_url is public profile info; email/phone/id_card_url remain excluded.

3. Important Notes
- The functions must be dropped first because Postgres cannot change a function's return type in place.
- Only function definitions are replaced — no table data is touched.
*/

DROP FUNCTION IF EXISTS public.get_public_profile(uuid);
DROP FUNCTION IF EXISTS public.get_user_friends(uuid);

CREATE FUNCTION public.get_public_profile(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  username text,
  full_name text,
  verification_status verification_status_enum,
  created_at timestamptz,
  friend_count bigint,
  avatar_url text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.username,
    p.full_name,
    p.verification_status,
    p.created_at,
    (
      SELECT count(*)
      FROM friendships f
      WHERE f.status = 'accepted'
        AND (f.requester_id = p_user_id OR f.addressee_id = p_user_id)
    ),
    p.avatar_url
  FROM profiles p
  WHERE p.id = p_user_id;
$$;

CREATE FUNCTION public.get_user_friends(p_user_id uuid)
RETURNS TABLE (
  friend_id uuid,
  friend_name text,
  friend_username text,
  since timestamptz,
  friend_avatar_url text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE WHEN f.requester_id = p_user_id THEN f.addressee_id ELSE f.requester_id END,
    p.full_name,
    p.username,
    f.updated_at,
    p.avatar_url
  FROM friendships f
  JOIN profiles p ON p.id = CASE WHEN f.requester_id = p_user_id THEN f.addressee_id ELSE f.requester_id END
  WHERE f.status = 'accepted'
    AND (f.requester_id = p_user_id OR f.addressee_id = p_user_id)
  ORDER BY f.updated_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_profile(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_friends(uuid) TO authenticated;
