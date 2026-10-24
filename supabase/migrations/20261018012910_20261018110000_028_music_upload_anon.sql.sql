/*
# Fix background music uploads failing for unsigned-in admins

1. Problem
- The admin panel can be opened after entering the PIN without signing in to an account.
- The `background-music` storage bucket only allowed uploads for `authenticated` users,
  so when no account session was present the upload was rejected with a permission error
  and the admin page showed no feedback.

2. Security changes
- Update the `music_upload_authenticated` and `music_delete_authenticated` policies on
  `storage.objects` to also allow `anon`, matching the existing `slideshow` bucket policy
  that already powers logo uploads the same way (PIN-gated admin UI only).
- Public read access is unchanged.

3. Important Notes
- No tables, columns, or functions are changed. No data is affected.
- The bucket remains public-read so every visitor can stream the music.
*/

DROP POLICY IF EXISTS "music_upload_authenticated" ON storage.objects;
CREATE POLICY "music_upload_authenticated" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'background-music');

DROP POLICY IF EXISTS "music_delete_authenticated" ON storage.objects;
CREATE POLICY "music_delete_authenticated" ON storage.objects
  FOR DELETE TO anon, authenticated
  USING (bucket_id = 'background-music');
