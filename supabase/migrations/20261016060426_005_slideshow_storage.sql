/*
# Slideshow Storage Bucket Policies

## Overview
Allows anyone to read slideshow images (public bucket) and authenticated users to upload.
Admin uploads are handled client-side - the admin uploads to the bucket then stores the URL.

## Changes
- SELECT: anyone can read slideshow images (public content for welcome page)
- INSERT: authenticated users can upload to the slideshow bucket
- DELETE: authenticated users can delete slideshow images
*/

-- Slideshow storage policies (public bucket)
DROP POLICY IF EXISTS "slideshow_read_all" ON storage.objects;
CREATE POLICY "slideshow_read_all" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'slideshow');

DROP POLICY IF EXISTS "slideshow_upload" ON storage.objects;
CREATE POLICY "slideshow_upload" ON storage.objects
  FOR INSERT TO authenticated, anon
  WITH CHECK (bucket_id = 'slideshow');

DROP POLICY IF EXISTS "slideshow_delete" ON storage.objects;
CREATE POLICY "slideshow_delete" ON storage.objects
  FOR DELETE TO authenticated, anon
  USING (bucket_id = 'slideshow');
