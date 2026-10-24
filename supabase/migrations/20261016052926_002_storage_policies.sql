/*
# Storage Policies for ID Cards and Post Media

## Overview
Sets up RLS policies on the storage buckets for ID card images (private) and post media (public).

## Changes
1. id-cards bucket (private):
   - Authenticated users can upload to their own folder
   - Only the owner can read their own ID card
   - Admins read all ID cards via the service role (server-side)
2. post-media bucket (public):
   - Authenticated users can upload to their own folder
   - Anyone can read post media (it's public content)
   - Users can delete their own media

## Important Notes
- ID card images are stored privately so only the uploading user and admins (via service role) can see them
- Post media is public so anyone viewing the feed can see photos/videos
*/

-- ID cards storage policies (private bucket)
DROP POLICY IF EXISTS "id_cards_upload_own" ON storage.objects;
CREATE POLICY "id_cards_upload_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'id-cards' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "id_cards_read_own" ON storage.objects;
CREATE POLICY "id_cards_read_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'id-cards' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Post media storage policies (public bucket)
DROP POLICY IF EXISTS "post_media_upload_own" ON storage.objects;
CREATE POLICY "post_media_upload_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'post-media' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "post_media_read_all" ON storage.objects;
CREATE POLICY "post_media_read_all" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'post-media');

DROP POLICY IF EXISTS "post_media_delete_own" ON storage.objects;
CREATE POLICY "post_media_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'post-media' AND auth.uid()::text = (storage.foldername(name))[1]);
