/*
# Geajao Social Media Platform - Initial Schema

## Overview
Creates the complete database schema for the Geajao social media platform by Mukhosh.
Includes user profiles, posts, ID card verification, admin settings, and slideshow management.

## New Tables

### 1. profiles
- Extends Supabase auth.users with app-specific data
- `id` (uuid, references auth.users, primary key)
- `username` (text, unique, not null) - login username
- `full_name` (text, not null) - real name
- `email` (text) - email address (optional, one of email/phone required)
- `phone` (text) - mobile number (optional, one of email/phone required)
- `verification_status` (enum: 'unverified', 'pending', 'verified', 'rejected') - default 'unverified'
- `id_card_url` (text) - URL to uploaded ID card image in storage
- `is_blocked` (boolean, default false) - admin can block users
- `restricted_until` (timestamptz) - if set, user is restricted until this time
- `created_at` (timestamptz, default now())
- `updated_at` (timestamptz, default now())

### 2. posts
- Stores all posts (text, photo, or video) from verified users
- `id` (uuid, primary key)
- `user_id` (uuid, references profiles, not null)
- `content_type` (enum: 'text', 'photo', 'video')
- `text_content` (text) - the message text
- `media_url` (text) - URL to uploaded photo/video
- `is_removed` (boolean, default false) - admin can remove posts
- `created_at` (timestamptz, default now())

### 3. slideshow_photos
- Photos shown on the welcome page slideshow, managed by admin
- `id` (uuid, primary key)
- `photo_url` (text, not null)
- `display_order` (integer, default 0)
- `is_active` (boolean, default true)
- `created_at` (timestamptz, default now())

### 4. admin_settings
- Stores the fixed admin PIN and any other admin config
- `id` (uuid, primary key)
- `admin_pin` (text, not null) - the fixed PIN for admin access
- `created_at` (timestamptz, default now())

## Enums
- `verification_status_enum`: 'unverified', 'pending', 'verified', 'rejected'
- `content_type_enum`: 'text', 'photo', 'video'

## Security (RLS)
- profiles: users can read/update own profile
- posts: verified users can read non-removed posts; verified users can insert own posts; admin can remove posts via security definer
- slideshow_photos: anyone can read active photos (welcome page is public)
- admin_settings: no direct access from anon/authenticated (only via security definer functions)

## Important Notes
1. The admin PIN is set to '482719' by default
2. ID card images and post media are stored in Supabase Storage buckets
3. A trigger function auto-creates a profile row when a new auth user signs up
4. Security definer functions handle admin verification and privileged actions
*/

-- Create enums
DO $$ BEGIN
  CREATE TYPE verification_status_enum AS ENUM ('unverified', 'pending', 'verified', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE content_type_enum AS ENUM ('text', 'photo', 'video');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  full_name text NOT NULL,
  email text,
  phone text,
  verification_status verification_status_enum NOT NULL DEFAULT 'unverified',
  id_card_url text,
  is_blocked boolean NOT NULL DEFAULT false,
  restricted_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies: users can read and update their own profile
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Create posts table
CREATE TABLE IF NOT EXISTS posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content_type content_type_enum NOT NULL DEFAULT 'text',
  text_content text,
  media_url text,
  is_removed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Posts: verified, non-blocked, non-restricted users can see non-removed posts
DROP POLICY IF EXISTS "posts_select_verified" ON posts;
CREATE POLICY "posts_select_verified" ON posts FOR SELECT
  TO authenticated USING (
    NOT is_removed
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.verification_status = 'verified'
      AND profiles.is_blocked = false
      AND (profiles.restricted_until IS NULL OR profiles.restricted_until < now())
    )
  );

-- Posts: verified users can insert their own posts
DROP POLICY IF EXISTS "posts_insert_own" ON posts;
CREATE POLICY "posts_insert_own" ON posts FOR INSERT
  TO authenticated WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.verification_status = 'verified'
      AND profiles.is_blocked = false
      AND (profiles.restricted_until IS NULL OR profiles.restricted_until < now())
    )
  );

-- Posts: users can delete their own posts
DROP POLICY IF EXISTS "posts_delete_own" ON posts;
CREATE POLICY "posts_delete_own" ON posts FOR DELETE
  TO authenticated USING (user_id = auth.uid());

-- Create slideshow_photos table
CREATE TABLE IF NOT EXISTS slideshow_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_url text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE slideshow_photos ENABLE ROW LEVEL SECURITY;

-- Slideshow: anyone (including anon) can read active photos for the welcome page
DROP POLICY IF EXISTS "slideshow_select_all" ON slideshow_photos;
CREATE POLICY "slideshow_select_all" ON slideshow_photos FOR SELECT
  TO anon, authenticated USING (is_active = true);

-- Create admin_settings table
CREATE TABLE IF NOT EXISTS admin_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_pin text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;

-- Insert default admin PIN if not exists
INSERT INTO admin_settings (admin_pin)
SELECT '482719'
WHERE NOT EXISTS (SELECT 1 FROM admin_settings);

-- ============================================
-- Security Definer Functions for Admin Actions
-- ============================================

-- Function to verify admin PIN
CREATE OR REPLACE FUNCTION verify_admin_pin(input_pin text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admin_settings WHERE admin_pin = input_pin
  );
END;
$$;

-- Function to get all profiles (admin only, requires PIN)
CREATE OR REPLACE FUNCTION admin_get_all_profiles(input_pin text)
RETURNS TABLE (
  id uuid,
  username text,
  full_name text,
  email text,
  phone text,
  verification_status verification_status_enum,
  id_card_url text,
  is_blocked boolean,
  restricted_until timestamptz,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM admin_settings WHERE admin_pin = input_pin) THEN
    RAISE EXCEPTION 'Invalid admin PIN';
  END IF;
  RETURN QUERY SELECT id, username, full_name, email, phone, verification_status, id_card_url, is_blocked, restricted_until, created_at FROM profiles ORDER BY created_at DESC;
END;
$$;

-- Function to update verification status (admin only)
CREATE OR REPLACE FUNCTION admin_update_verification(
  input_pin text,
  target_user_id uuid,
  new_status verification_status_enum
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM admin_settings WHERE admin_pin = input_pin) THEN
    RAISE EXCEPTION 'Invalid admin PIN';
  END IF;
  UPDATE profiles SET verification_status = new_status, updated_at = now()
  WHERE id = target_user_id;
END;
$$;

-- Function to block/unblock user (admin only)
CREATE OR REPLACE FUNCTION admin_set_blocked(
  input_pin text,
  target_user_id uuid,
  blocked boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM admin_settings WHERE admin_pin = input_pin) THEN
    RAISE EXCEPTION 'Invalid admin PIN';
  END IF;
  UPDATE profiles SET is_blocked = blocked, updated_at = now()
  WHERE id = target_user_id;
END;
$$;

-- Function to restrict user until a given time (admin only)
CREATE OR REPLACE FUNCTION admin_set_restriction(
  input_pin text,
  target_user_id uuid,
  restrict_until timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM admin_settings WHERE admin_pin = input_pin) THEN
    RAISE EXCEPTION 'Invalid admin PIN';
  END IF;
  UPDATE profiles SET restricted_until = restrict_until, updated_at = now()
  WHERE id = target_user_id;
END;
$$;

-- Function to remove a post (admin only)
CREATE OR REPLACE FUNCTION admin_remove_post(
  input_pin text,
  target_post_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM admin_settings WHERE admin_pin = input_pin) THEN
    RAISE EXCEPTION 'Invalid admin PIN';
  END IF;
  UPDATE posts SET is_removed = true WHERE id = target_post_id;
END;
$$;

-- Function to get all posts including removed ones (admin only)
CREATE OR REPLACE FUNCTION admin_get_all_posts(input_pin text)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  content_type content_type_enum,
  text_content text,
  media_url text,
  is_removed boolean,
  created_at timestamptz,
  author_name text,
  author_username text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM admin_settings WHERE admin_pin = input_pin) THEN
    RAISE EXCEPTION 'Invalid admin PIN';
  END IF;
  RETURN QUERY
    SELECT p.id, p.user_id, p.content_type, p.text_content, p.media_url, p.is_removed, p.created_at,
           pr.full_name AS author_name, pr.username AS author_username
    FROM posts p
    LEFT JOIN profiles pr ON pr.id = p.user_id
    ORDER BY p.created_at DESC;
END;
$$;

-- Function to add a slideshow photo (admin only)
CREATE OR REPLACE FUNCTION admin_add_slideshow_photo(
  input_pin text,
  photo_url text,
  display_order integer DEFAULT 0
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM admin_settings WHERE admin_pin = input_pin) THEN
    RAISE EXCEPTION 'Invalid admin PIN';
  END IF;
  INSERT INTO slideshow_photos (photo_url, display_order)
  VALUES (photo_url, display_order)
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;

-- Function to remove a slideshow photo (admin only)
CREATE OR REPLACE FUNCTION admin_remove_slideshow_photo(
  input_pin text,
  photo_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM admin_settings WHERE admin_pin = input_pin) THEN
    RAISE EXCEPTION 'Invalid admin PIN';
  END IF;
  DELETE FROM slideshow_photos WHERE id = photo_id;
END;
$$;

-- Function to get all slideshow photos (admin only, including inactive)
CREATE OR REPLACE FUNCTION admin_get_all_slideshow_photos(input_pin text)
RETURNS TABLE (
  id uuid,
  photo_url text,
  display_order integer,
  is_active boolean,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM admin_settings WHERE admin_pin = input_pin) THEN
    RAISE EXCEPTION 'Invalid admin PIN';
  END IF;
  RETURN QUERY SELECT id, photo_url, display_order, is_active, created_at FROM slideshow_photos ORDER BY display_order ASC, created_at DESC;
END;
$$;

-- Grant execute on admin functions to authenticated
GRANT EXECUTE ON FUNCTION verify_admin_pin(text) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_get_all_profiles(text) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_update_verification(text, uuid, verification_status_enum) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_set_blocked(text, uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_set_restriction(text, uuid, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_remove_post(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_get_all_posts(text) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_add_slideshow_photo(text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_remove_slideshow_photo(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_get_all_slideshow_photos(text) TO authenticated;

-- Also grant verify_admin_pin to anon (needed before login)
GRANT EXECUTE ON FUNCTION verify_admin_pin(text) TO anon;

-- ============================================
-- Trigger: Auto-create profile on signup
-- ============================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, username, full_name, email, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'phone', '')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON slideshow_photos TO anon, authenticated;
