/*
# Show avatars on active notes

1. Modified Functions
- `get_active_notes()`: dropped and recreated, now also returns `author_avatar_url` (text) so the notes strip in the feed can show each note author's profile picture.

2. Security
- Same SECURITY DEFINER function, updated in place. avatar_url is public profile info; no private data exposed.

3. Important Notes
- The function must be dropped first because Postgres cannot change a function's return type in place.
- No table data is touched.
*/

DROP FUNCTION IF EXISTS public.get_active_notes();

CREATE FUNCTION public.get_active_notes()
RETURNS TABLE (
  note_id uuid,
  user_id uuid,
  author_name text,
  author_username text,
  author_avatar_url text,
  content text,
  expires_at timestamptz,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    n.id,
    n.user_id,
    p.full_name,
    p.username,
    p.avatar_url,
    n.content,
    n.expires_at,
    n.created_at
  FROM notes n
  JOIN profiles p ON p.id = n.user_id
  WHERE n.expires_at > now()
  ORDER BY n.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_active_notes() TO authenticated;
