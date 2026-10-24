/*
# Fix Ambiguous Column References in Admin Functions

## Problem
The admin_get_all_profiles and admin_get_all_slideshow_photos functions use
bare column names in RETURN QUERY SELECT statements. PostgreSQL can't tell
if "id" refers to the PL/pgSQL output column or the table column, causing
an "ambiguous column reference" error.

## Fix
Explicitly prefix all column names with the table alias (profiles, slideshow_photos)
in the RETURN QUERY SELECT statements.
*/

-- Fix admin_get_all_profiles
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
  RETURN QUERY
    SELECT profiles.id, profiles.username, profiles.full_name, profiles.email,
           profiles.phone, profiles.verification_status, profiles.id_card_url,
           profiles.is_blocked, profiles.restricted_until, profiles.created_at
    FROM profiles ORDER BY profiles.created_at DESC;
END;
$$;

-- Fix admin_get_all_slideshow_photos
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
  RETURN QUERY
    SELECT slideshow_photos.id, slideshow_photos.photo_url, slideshow_photos.display_order,
           slideshow_photos.is_active, slideshow_photos.created_at
    FROM slideshow_photos ORDER BY slideshow_photos.display_order ASC, slideshow_photos.created_at DESC;
END;
$$;

-- Re-grant permissions
GRANT EXECUTE ON FUNCTION admin_get_all_profiles(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_get_all_slideshow_photos(text) TO anon, authenticated;
