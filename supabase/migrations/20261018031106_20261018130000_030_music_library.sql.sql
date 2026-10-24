/*
# Multi-track background music library

1. New Table
- `music_tracks`: id, title, url (public storage URL), created_at.
  Admin-managed catalog of background songs. Anyone (anon + authenticated) can
  read it so all users can pick a song. Only admin functions can insert/delete.

2. Admin Functions (SECURITY DEFINER, PIN-gated)
- `admin_add_music_track(input_pin, p_title, p_url)` → returns the new row's id.
- `admin_delete_music_track(input_pin, p_track_id)` → deletes one track.
- `admin_list_music_tracks(input_pin)` → returns all tracks ordered newest first.

3. Public Function
- `get_music_tracks()` → returns id, title, url, created_at for all tracks,
  newest first. Callable by anon + authenticated.

4. Storage
- Reuses the existing `background-music` bucket (public read, anon+authenticated
  insert already granted in migration 028). No new bucket needed.

5. Backward compatibility
- `site_settings.music_url`, `admin_set_music`, `admin_get_music`, and
  `get_background_music` remain untouched (deprecated by the new library but kept
  to avoid breaking any cached state).
*/
CREATE TABLE IF NOT EXISTS public.music_tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT 'Untitled',
  url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.music_tracks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "music_tracks_read_all" ON public.music_tracks
  FOR SELECT TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION public.admin_add_music_track(input_pin text, p_title text, p_url text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE new_id uuid;
BEGIN
  IF NOT verify_admin_pin(input_pin) THEN
    RAISE EXCEPTION 'Invalid admin PIN';
  END IF;
  INSERT INTO music_tracks (title, url)
  VALUES (NULLIF(p_title, '') || '', p_url)
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_music_track(input_pin text, p_track_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT verify_admin_pin(input_pin) THEN
    RAISE EXCEPTION 'Invalid admin PIN';
  END IF;
  DELETE FROM music_tracks WHERE id = p_track_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_music_tracks(input_pin text)
RETURNS TABLE (id uuid, title text, url text, created_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT verify_admin_pin(input_pin) THEN
    RAISE EXCEPTION 'Invalid admin PIN';
  END IF;
  RETURN QUERY SELECT t.id, t.title, t.url, t.created_at
  FROM music_tracks t
  ORDER BY t.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_music_tracks()
RETURNS TABLE (id uuid, title text, url text, created_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT id, title, url, created_at FROM music_tracks ORDER BY created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.admin_add_music_track(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_music_track(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_music_tracks(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_music_tracks() TO anon, authenticated;
