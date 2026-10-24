/*
# Background music + mention feed pinning support

1. Modified Tables
- `site_settings`: adds `music_url` (text, nullable) — public URL of the admin-uploaded background music file in the `background-music` storage bucket.

2. New Functions
- `admin_set_music(input_pin text, music_url text)` — admin-only, sets or removes (NULL/empty) the music URL.
- `admin_get_music(input_pin text)` — admin-only, returns current music URL.
- `get_background_music()` — returns the music URL to any caller (anon + authenticated) so all pages can play it. Returns NULL when none set.

3. Storage
- `background-music` bucket (public read): the admin uploads audio files at the top level (no folder restriction since uploads go through the admin's session). Any authenticated user can upload — the admin panel is the only UI that does this, and it is PIN-gated.

4. New Function
- `get_mentioned_post_ids()` — returns the post ids that mention the current user, so the feed can pin those posts to the top.

5. Important Notes
- Music persists across pages via a single HTMLAudioElement managed in React context.
- Mute preference is stored in the browser (localStorage), per device.
- No destructive changes.
*/

-- 1. Column
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS music_url text;

-- 2. Admin + public functions
CREATE OR REPLACE FUNCTION public.admin_set_music(input_pin text, music_url text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT verify_admin_pin(input_pin) THEN
    RAISE EXCEPTION 'Invalid admin PIN';
  END IF;
  UPDATE site_settings
  SET music_url = NULLIF(music_url, ''), updated_at = now()
  WHERE id = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_music(input_pin text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT music_url FROM site_settings WHERE id = 1;
$$;

CREATE OR REPLACE FUNCTION public.get_background_music()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT music_url FROM site_settings WHERE id = 1;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_music(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_music(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_background_music() TO anon, authenticated;

-- 3. Storage bucket
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'background-music') THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('background-music', 'background-music', true);
  END IF;
END;
$$;

DROP POLICY IF EXISTS "music_upload_authenticated" ON storage.objects;
CREATE POLICY "music_upload_authenticated" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'background-music');

DROP POLICY IF EXISTS "music_read_all" ON storage.objects;
CREATE POLICY "music_read_all" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'background-music');

DROP POLICY IF EXISTS "music_delete_authenticated" ON storage.objects;
CREATE POLICY "music_delete_authenticated" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'background-music');

-- 4. Mention pinning helper
CREATE OR REPLACE FUNCTION public.get_mentioned_post_ids()
RETURNS TABLE (post_id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT post_id FROM post_mentions WHERE mentioned_user_id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.get_mentioned_post_ids() TO authenticated;
