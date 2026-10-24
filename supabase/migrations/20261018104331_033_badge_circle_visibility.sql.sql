/*
# Badge-circle post visibility

1. New Columns
- `posts.audience` (text, not null, default 'public'): 'public' = everyone sees it; 'badge' = only badge holders sharing the author's badge (and the author) can see it. Existing posts default to 'public' so nothing disappears.

2. Security
- Recreated the posts SELECT policy: a verified user sees public posts plus badge-circle posts only when they hold the same badge as the author (or authored it themselves).
- Recreated the posts INSERT policy: posting with audience='badge' requires the author to hold a badge (stored on their profile).

3. Modified Functions
- `get_feed_posts(limit_count, badge_filter)` dropped and recreated (return shape changed): badge-circle posts are excluded from the 'all' feed for viewers who do not share the author's badge, and only included when badge_filter matches the author's badge.

4. Important Notes
- Badge is stored on profiles; circle membership is determined by joining the author's profile at read time.
- NULL-badge users see exactly the public feed as before.
*/

-- 1. Audience column
ALTER TABLE posts ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'public';
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'posts_audience_check'
      AND conrelid = 'public.posts'::regclass
  ) THEN
    ALTER TABLE posts ADD CONSTRAINT posts_audience_check
      CHECK (audience IN ('public', 'badge'));
  END IF;
END $$;

-- 2. RLS: circle posts only visible to same-badge holders (or the author)
DROP POLICY IF EXISTS "posts_select_verified" ON posts;
CREATE POLICY "posts_select_verified" ON posts FOR SELECT
  TO authenticated USING (
    NOT is_removed
    AND (
      audience = 'public'
      OR user_id = auth.uid()
      OR (
        audience = 'badge'
        AND EXISTS (
          SELECT 1 FROM profiles author
          WHERE author.id = posts.user_id
            AND author.badge IS NOT NULL
            AND author.badge = (SELECT me.badge FROM profiles me WHERE me.id = auth.uid())
        )
      )
    )
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.verification_status = 'verified'
      AND profiles.is_blocked = false
      AND (profiles.restricted_until IS NULL OR profiles.restricted_until < now())
    )
  );

DROP POLICY IF EXISTS "posts_insert_own" ON posts;
CREATE POLICY "posts_insert_own" ON posts FOR INSERT
  TO authenticated WITH CHECK (
    user_id = auth.uid()
    AND (
      audience = 'public'
      OR (
        audience = 'badge'
        AND EXISTS (
          SELECT 1 FROM profiles me
          WHERE me.id = auth.uid() AND me.badge IS NOT NULL
        )
      )
    )
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.verification_status = 'verified'
      AND profiles.is_blocked = false
      AND (profiles.restricted_until IS NULL OR profiles.restricted_until < now())
    )
  );

-- 3. Feed function respects circle visibility
DROP FUNCTION IF EXISTS get_feed_posts(integer);
DROP FUNCTION IF EXISTS get_feed_posts(integer, text);

CREATE OR REPLACE FUNCTION get_feed_posts(
  limit_count integer DEFAULT 50,
  badge_filter text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  content_type content_type_enum,
  text_content text,
  media_url text,
  is_removed boolean,
  created_at timestamptz,
  author_name text,
  author_username text,
  author_avatar_url text,
  author_badge text,
  audience text
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
           pr.username AS author_username,
           pr.avatar_url AS author_avatar_url,
           pr.badge AS author_badge,
           p.audience
    FROM posts p
    LEFT JOIN profiles pr ON pr.id = p.user_id
    WHERE p.is_removed = false
      AND (
        p.audience = 'public'
        OR (p.user_id = auth.uid())
        OR (
          p.audience = 'badge'
          AND pr.badge IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM profiles me
            WHERE me.id = auth.uid() AND me.badge = pr.badge
          )
        )
      )
      AND (
        badge_filter IS NULL OR badge_filter = 'all'
        OR (badge_filter = 'badge_holders' AND pr.badge IS NOT NULL AND p.audience = 'badge')
        OR (badge_filter IN ('admin', 'cadet', 'ex_cadet') AND pr.badge = badge_filter AND p.audience = 'badge')
      )
    ORDER BY p.created_at DESC
    LIMIT limit_count;
END;
$$;

GRANT EXECUTE ON FUNCTION get_feed_posts(integer, text) TO anon, authenticated;
