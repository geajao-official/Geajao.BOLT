/*
# Profile pictures, post reactions, and post comments

1. Modified Tables
- `profiles`: adds `avatar_url` (text) — public URL of the user's profile picture in the avatars storage bucket. Nullable; users without a picture fall back to their initial letter.

2. New Tables
- `post_reactions`: one reaction per user per post.
  - `post_id` (uuid, references posts, cascade delete)
  - `user_id` (uuid, references profiles, cascade delete, defaults to the signed-in user)
  - `reaction` (text, one of: like, love, laugh, wow, sad)
  - primary key (post_id, user_id) so a user can only have one reaction per post; changing reaction is an upsert.
- `post_comments`: comments under a post.
  - `id` (uuid, primary key)
  - `post_id` (uuid, references posts, cascade delete)
  - `user_id` (uuid, references profiles, cascade delete, defaults to the signed-in user)
  - `content` (text, not null, max 1000 characters enforced with a check)
  - `created_at` (timestamptz, default now())

3. Storage
- `avatars` bucket (public read): each authenticated user can upload/manage only files inside their own `auth.uid()` folder. Bucket is created only if it does not exist (idempotent DO block).

4. Security
- RLS enabled on both new tables.
- `post_reactions`: authenticated users can read all reactions, but insert/update/delete only their own (user_id = auth.uid()).
- `post_comments`: authenticated users can read all comments, insert their own, delete their own. No update (comments are immutable; users delete and repost instead).
- Avatars storage: public read (profile pictures are public), write/delete restricted to the owner's folder.
- Reaction/comment counts are computed in the frontend by fetching rows (no aggregate functions exposed).

5. Important Notes
- No destructive changes: only ADD COLUMN IF NOT EXISTS and CREATE TABLE IF NOT EXISTS are used.
- Old posts have zero reactions/comments until users interact with them.
*/

-- 1. Profile picture column
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url text;

-- 2. Reactions
CREATE TABLE IF NOT EXISTS post_reactions (
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  reaction text NOT NULL CHECK (reaction IN ('like', 'love', 'laugh', 'wow', 'sad')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

ALTER TABLE post_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reactions_select_authenticated" ON post_reactions;
CREATE POLICY "reactions_select_authenticated" ON post_reactions
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "reactions_insert_own" ON post_reactions;
CREATE POLICY "reactions_insert_own" ON post_reactions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "reactions_update_own" ON post_reactions;
CREATE POLICY "reactions_update_own" ON post_reactions
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "reactions_delete_own" ON post_reactions;
CREATE POLICY "reactions_delete_own" ON post_reactions
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 3. Comments
CREATE TABLE IF NOT EXISTS post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_post_comments_post ON post_comments(post_id, created_at);

ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comments_select_authenticated" ON post_comments;
CREATE POLICY "comments_select_authenticated" ON post_comments
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "comments_insert_own" ON post_comments;
CREATE POLICY "comments_insert_own" ON post_comments
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "comments_delete_own" ON post_comments;
CREATE POLICY "comments_delete_own" ON post_comments
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 4. Avatars bucket (public read, per-user folders)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'avatars') THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('avatars', 'avatars', true);
  END IF;
END;
$$;

DROP POLICY IF EXISTS "avatars_upload_own" ON storage.objects;
CREATE POLICY "avatars_upload_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "avatars_read_all" ON storage.objects;
CREATE POLICY "avatars_read_all" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_delete_own" ON storage.objects;
CREATE POLICY "avatars_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
