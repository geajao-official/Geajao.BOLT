/*
# Fix admin_set_music ambiguous column reference

1. Problem
- `admin_set_music` updated `site_settings SET music_url = NULLIF(music_url, '')`.
- Postgres resolved the bare `music_url` inside NULLIF to the table column, making the
  comparison ambiguous against the function parameter of the same name, and the call
  failed with `column reference "music_url" is ambiguous`.
- The file upload itself always succeeded; only the final "register this track" step
  crashed, which is why the admin page reported "Could not upload the music file".

2. Fix
- Reference the parameter explicitly as `admin_set_music.music_url`, matching the
  pattern already used by `admin_set_site_logo`.
- Recreate `admin_get_music` without a PIN check removed? No - left unchanged, but it
  also referenced only columns and was fine.

3. Important Notes
- No data changed. The two music files the admin uploaded earlier remain in storage.
- After this fix, calling the function again sets the track live site-wide.
*/

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
  SET music_url = NULLIF(admin_set_music.music_url, ''), updated_at = now()
  WHERE id = 1;
END;
$$;
