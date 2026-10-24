/*
# Fix: All verified users should see all posts

## Problem
The get_feed_posts RPC function may not work reliably through PostgREST.
The root cause is that profiles RLS (auth.uid() = id) prevents users from
reading other users' profiles, which breaks the feed query's author join.

## Fix
1. Create a public_profiles VIEW owned by postgres that exposes only
   id, username, and full_name (no email, phone, or other private data).
   Since the view is owned by postgres (BYPASSRLS), it bypasses profiles RLS.
2. Grant SELECT on the view to anon and authenticated.
3. The feed query can now join posts with public_profiles without RLS issues.
*/

CREATE OR REPLACE VIEW public_profiles AS
SELECT id, username, full_name FROM profiles;

GRANT SELECT ON public_profiles TO anon, authenticated;
