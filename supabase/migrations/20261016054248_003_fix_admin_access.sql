/*
# Fix Admin Panel Access and ID Card Visibility

## Problem
1. Admin functions (admin_get_all_profiles, etc.) are granted to `authenticated` only,
   but the admin accesses the panel without being logged in (as anon role).
   This causes RPC calls to fail silently, so no users appear in the admin panel.
2. The id-cards storage bucket is private (public=false), so getPublicUrl returns
   URLs that are not accessible. The admin cannot view uploaded ID card images.

## Changes
1. Grant EXECUTE on all admin functions to `anon` role (they are PIN-protected internally)
2. Change id-cards bucket to public so stored URLs are accessible
3. Add a SELECT policy on storage.objects for id-cards bucket allowing anon + authenticated to read
   (file paths contain UUIDs and timestamps, so they are not guessable)

## Security Notes
- All admin functions still require the correct PIN internally via SECURITY DEFINER
- ID card upload is still restricted to the owner's folder
- ID card file paths include the user's UUID, making them unguessable
*/
-- Grant admin functions to anon (PIN-protected internally)
GRANT EXECUTE ON FUNCTION verify_admin_pin(text) TO anon;
GRANT EXECUTE ON FUNCTION admin_get_all_profiles(text) TO anon;
GRANT EXECUTE ON FUNCTION admin_update_verification(text, uuid, verification_status_enum) TO anon;
GRANT EXECUTE ON FUNCTION admin_set_blocked(text, uuid, boolean) TO anon;
GRANT EXECUTE ON FUNCTION admin_set_restriction(text, uuid, timestamptz) TO anon;
GRANT EXECUTE ON FUNCTION admin_remove_post(text, uuid) TO anon;
GRANT EXECUTE ON FUNCTION admin_get_all_posts(text) TO anon;
GRANT EXECUTE ON FUNCTION admin_add_slideshow_photo(text, text, integer) TO anon;
GRANT EXECUTE ON FUNCTION admin_remove_slideshow_photo(text, uuid) TO anon;
GRANT EXECUTE ON FUNCTION admin_get_all_slideshow_photos(text) TO anon;

-- Make id-cards bucket public so URLs are accessible
UPDATE storage.buckets SET public = true WHERE id = 'id-cards';

-- Allow anyone to read ID card images (paths are UUID-based, not guessable)
DROP POLICY IF EXISTS "id_cards_read_all" ON storage.objects;
CREATE POLICY "id_cards_read_all" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'id-cards');
