/*
# Fix: Feed posts not showing from other users

## Problem
The feed query uses `profiles!inner(full_name, username)` to join author info.
But profiles RLS only allows users to SELECT their own profile (auth.uid() = id).
When a verified user fetches posts, the inner join on profiles is blocked by RLS
for posts authored by OTHER users, causing those posts to be silently dropped.

## Fix
Create a SECURITY DEFINER function `get_feed_posts()` that returns non-removed
posts with author name and username, bypassing profiles RLS for the join.
This only exposes full_name and username (not email/phone), which are public
display fields needed for the feed.

## Security
- Only returns non-removed posts
- Only exposes full_name and username (not email, phone, or other private data)
- The caller must still be authenticated (function is granted to authenticated)
*/

CREATE OR REPLACE FUNCTION get_feed_posts(limit_count integer DEFAULT 50)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  content_type content_type_enum,
  text_content text,
  media_url text,
  is_removed boolean,
  created_at timestamptz,
  author_name text,
  author_username text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    SELECT p.id, p.user_id, p.content_type, p.text_content, p.media_url,
           p.is_removed, p.created_at,
           pr.full_name AS author_name,
           pr.username AS author_username
    FROM posts p
    LEFT JOIN profiles pr ON pr.id = p.user_id
    WHERE p.is_removed = false
    ORDER BY p.created_at DESC
    LIMIT limit_count;
END;
$$;

GRANT EXECUTE ON FUNCTION get_feed_posts(integer) TO authenticated;
