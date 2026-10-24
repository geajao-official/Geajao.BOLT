/*
# Notes feature (24-hour self-deleting posts)

## Purpose
Users can post short "notes" that automatically disappear after 24 hours. Notes are visible to everyone on the feed while active, and each user can view their own active notes from their profile page.

## New Table
- `notes`
  - `id` (uuid, PK)
  - `user_id` (uuid, FK -> auth.users, DEFAULT auth.uid(), ON DELETE CASCADE)
  - `content` (text, NOT NULL, max 500 chars enforced by CHECK)
  - `expires_at` (timestamptz, NOT NULL) — set to now() + 24 hours on insert
  - `created_at` (timestamptz, DEFAULT now())

## Security
- RLS enabled; users can only insert/update/delete their own notes
- Anyone authenticated can read active (non-expired) notes for the feed
- Expired notes are filtered out at query time; a cleanup function deletes them
- Only authenticated users interact with notes
*/

CREATE TABLE IF NOT EXISTS notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (char_length(content) <= 500),
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notes_user ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_expires ON notes(expires_at);

ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read non-expired notes
DROP POLICY IF EXISTS "select_active_notes" ON notes;
CREATE POLICY "select_active_notes"
  ON notes FOR SELECT
  TO authenticated
  USING (expires_at > now());

-- Users can create their own notes
DROP POLICY IF EXISTS "insert_own_notes" ON notes;
CREATE POLICY "insert_own_notes"
  ON notes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND expires_at > now());

-- Users can update their own notes (only extend/shrink expiry, keep ownership)
DROP POLICY IF EXISTS "update_own_notes" ON notes;
CREATE POLICY "update_own_notes"
  ON notes FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own notes
DROP POLICY IF EXISTS "delete_own_notes" ON notes;
CREATE POLICY "delete_own_notes"
  ON notes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Cleanup function: deletes expired notes; callable by anyone authenticated.
-- Also callable by cron/service role via SECURITY DEFINER.
CREATE OR REPLACE FUNCTION public.cleanup_expired_notes()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM notes WHERE expires_at <= now();
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_expired_notes() TO authenticated, anon;

-- Helper: fetch active notes with author info, newest first
CREATE OR REPLACE FUNCTION public.get_active_notes()
RETURNS TABLE (
  note_id uuid,
  user_id uuid,
  author_name text,
  author_username text,
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
    n.content,
    n.expires_at,
    n.created_at
  FROM notes n
  JOIN profiles p ON p.id = n.user_id
  WHERE n.expires_at > now()
  ORDER BY n.created_at DESC
  LIMIT 100;
$$;

GRANT EXECUTE ON FUNCTION public.get_active_notes() TO authenticated;

-- Helper: fetch current user's own active notes (including ones about to expire)
CREATE OR REPLACE FUNCTION public.get_my_active_notes()
RETURNS TABLE (
  note_id uuid,
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
    n.content,
    n.expires_at,
    n.created_at
  FROM notes n
  WHERE n.user_id = auth.uid() AND n.expires_at > now()
  ORDER BY n.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_active_notes() TO authenticated;

-- Enable realtime so new notes appear live on the feed
ALTER PUBLICATION supabase_realtime ADD TABLE notes;
