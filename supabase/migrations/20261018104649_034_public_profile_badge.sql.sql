/*
# Public profile includes badge

1. Modified Functions
- `get_public_profile(p_user_id)` recreated to also return `badge text` (the user's Admin / Cadet / Ex-Cadet badge, or NULL). Earlier versions already returned avatar_url; that is preserved.

2. Security
- Still SECURITY DEFINER with the same member/friend visibility rule as before; only adds the non-sensitive badge field.
*/

DROP FUNCTION IF EXISTS public.get_public_profile(uuid);

CREATE OR REPLACE FUNCTION public.get_public_profile(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  username text,
  full_name text,
  verification_status verification_status_enum,
  created_at timestamptz,
  friend_count bigint,
  avatar_url text,
  badge text
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
    (SELECT count(*)::bigint FROM friendships f
      WHERE f.status = 'accepted'
        AND (f.requester_id = p.id OR f.addressee_id = p.id)),
    p.avatar_url,
    p.badge
  FROM profiles p
  WHERE p.id = p_user_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_profile(uuid) TO authenticated;
