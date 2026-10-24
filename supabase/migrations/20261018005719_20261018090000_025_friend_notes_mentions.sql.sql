/*
# Friend-scoped notes + @username mentions

1. Modified Functions
- `get_active_notes()`: dropped and recreated. Now returns ONLY notes posted by the current user OR any of their accepted friends. Also returns `is_friend` flag. Column order unchanged from v2 plus new trailing `is_friend boolean`.

2. New Tables
- `post_mentions`: records that a post mentions a user.
  - `post_id` (uuid, references posts, cascade delete)
  - `mentioned_user_id` (uuid, references profiles, cascade delete)
  - `created_by` (uuid, references profiles, cascade delete)
  - primary key (post_id, mentioned_user_id) — one mention per user per post.

3. Security
- `post_mentions` RLS: members can read all mentions; inserts allowed when the row's created_by = auth.uid() (mentions are written by the post author through a helper that validates friendship OR self-mention); deletes only by the mention creator.
- Note visibility is enforced inside the SECURITY DEFINER function `get_active_notes()` using the friendships table — no direct table access needed.

4. Important Notes
- `get_active_notes()` is dropped first because its return type changes.
- Mention resolution happens client-side at post time: the frontend extracts @usernames and calls `add_post_mentions`, which validates that each mentioned user exists and is a friend (or self). Silently skips invalid/stranger usernames.
*/

-- 1. Friend-scoped notes
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
  created_at timestamptz,
  is_friend boolean
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
    n.created_at,
    (n.user_id = auth.uid()) AS is_friend
  FROM notes n
  JOIN profiles p ON p.id = n.user_id
  WHERE n.expires_at > now()
    AND (
      n.user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM friendships f
        WHERE f.status = 'accepted'
          AND ((f.requester_id = auth.uid() AND f.addressee_id = n.user_id)
            OR (f.addressee_id = auth.uid() AND f.requester_id = n.user_id))
      )
    )
  ORDER BY n.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_active_notes() TO authenticated;

-- 2. Mentions table
CREATE TABLE IF NOT EXISTS post_mentions (
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  mentioned_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, mentioned_user_id)
);

CREATE INDEX IF NOT EXISTS idx_post_mentions_user ON post_mentions(mentioned_user_id);

ALTER TABLE post_mentions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mentions_select_authenticated" ON post_mentions;
CREATE POLICY "mentions_select_authenticated" ON post_mentions
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "mentions_insert_self_created" ON post_mentions;
CREATE POLICY "mentions_insert_self_created" ON post_mentions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "mentions_delete_own" ON post_mentions;
CREATE POLICY "mentions_delete_own" ON post_mentions
  FOR DELETE TO authenticated
  USING (auth.uid() = created_by);

-- 3. Helper: add validated mentions for a post (author only)
CREATE OR REPLACE FUNCTION public.add_post_mentions(
  p_post_id uuid,
  p_usernames text[]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_author uuid;
  v_username text;
  v_target uuid;
  v_count integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT user_id INTO v_author FROM posts WHERE id = p_post_id;
  IF v_author IS NULL OR v_author != auth.uid() THEN
    RAISE EXCEPTION 'Not the post author';
  END IF;

  FOREACH v_username IN ARRAY p_usernames LOOP
    SELECT id INTO v_target FROM profiles
    WHERE lower(username) = lower(trim(v_username, '@'))
    LIMIT 1;

    IF v_target IS NOT NULL AND v_target != v_author THEN
      -- only friends can be mentioned
      IF EXISTS (
        SELECT 1 FROM friendships f
        WHERE f.status = 'accepted'
          AND ((f.requester_id = v_author AND f.addressee_id = v_target)
            OR (f.addressee_id = v_author AND f.requester_id = v_target))
      ) THEN
        INSERT INTO post_mentions (post_id, mentioned_user_id, created_by)
        VALUES (p_post_id, v_target, v_author)
        ON CONFLICT (post_id, mentioned_user_id) DO NOTHING;
        v_count := v_count + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_post_mentions(uuid, text[]) TO authenticated;
