/*
# Public profile viewing

Allows any verified, signed-in user to view another user's public profile:
name, username, joined date, friends, active notes and posts.
Deliberately excludes private data: email, phone, id_card_url, blocked/restricted flags.
*/

-- Public profile info + friend count
CREATE OR REPLACE FUNCTION public.get_public_profile(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  username text,
  full_name text,
  verification_status verification_status_enum,
  created_at timestamptz,
  friend_count bigint
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
    )
  FROM profiles p
  WHERE p.id = p_user_id;
$$;

-- Friend list of any user (names/usernames only, no private data)
CREATE OR REPLACE FUNCTION public.get_user_friends(p_user_id uuid)
RETURNS TABLE (
  friend_id uuid,
  friend_name text,
  friend_username text,
  since timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE WHEN f.requester_id = p_user_id THEN f.addressee_id ELSE f.requester_id END,
    p.full_name,
    p.username,
    f.updated_at
  FROM friendships f
  JOIN profiles p ON p.id = CASE WHEN f.requester_id = p_user_id THEN f.addressee_id ELSE f.requester_id END
  WHERE f.status = 'accepted'
    AND (f.requester_id = p_user_id OR f.addressee_id = p_user_id)
  ORDER BY f.updated_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_profile(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_friends(uuid) TO authenticated;
