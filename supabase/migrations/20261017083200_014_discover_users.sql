/*
# Discover users function

## Purpose
Returns all verified users (excluding the current user) with their friendship status relative to the caller, so the frontend can show a "Discover" / "People you may know" list with appropriate send-request buttons.

## New Function (SECURITY DEFINER)
- `get_discover_users()` — returns all verified, non-blocked users except the caller, each with:
  - `user_id` (uuid)
  - `full_name` (text)
  - `username` (text)
  - `friendship_status` (text): 'none', 'pending_outgoing', 'pending_incoming', 'accepted', 'declined_outgoing', 'declined_incoming'

## Security
- Only returns verified users
- Only callable by authenticated users
- No admin involvement
*/

CREATE OR REPLACE FUNCTION public.get_discover_users()
RETURNS TABLE (
  user_id uuid,
  full_name text,
  username text,
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

GRANT EXECUTE ON FUNCTION public.get_discover_users() TO authenticated;
