/*
# Site settings (custom logo)

## Purpose
Stores site-wide settings currently just the custom logo URL. Admins upload a logo from the Admin Panel; it replaces the "Geajao" text in the header of the feed, welcome page, auth page, and verification page.

## New Table
- `site_settings`
  - `id` (integer PK, singleton row with id=1)
  - `logo_url` (text, nullable) — public URL of the uploaded logo image
  - `updated_at` (timestamptz)

## New Functions (SECURITY DEFINER)
- `admin_set_site_logo(input_pin text, logo_url text)` — sets the logo URL (admin-only, PIN verified). Pass empty string or NULL to remove the logo.
- `admin_get_site_logo(input_pin text)` — returns current logo URL (admin-only)
- `get_site_logo()` — returns the logo URL to any caller (anon + authenticated) so the public pages can display it. Returns NULL when no custom logo is set.

## Security
- Singleton row is not directly writable by clients; only the PIN-verified admin functions change it
- RLS enabled; public read allowed via policy on the single row (only exposes logo URL), no client insert/update/delete
- get_site_logo is SECURITY DEFINER so it works even for anon visitors on welcome/auth pages
*/

CREATE TABLE IF NOT EXISTS site_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  logo_url text,
  updated_at timestamptz DEFAULT now()
);

-- Seed the singleton row
INSERT INTO site_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

-- Public read of the singleton settings row (only contains the logo URL)
DROP POLICY IF EXISTS "public_read_site_settings" ON site_settings;
CREATE POLICY "public_read_site_settings"
  ON site_settings FOR SELECT
  TO anon, authenticated
  USING (true);

-- No client insert/update/delete policies: writes only via admin functions

-- Admin: set the logo
CREATE OR REPLACE FUNCTION public.admin_set_site_logo(input_pin text, logo_url text)
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
  SET logo_url = NULLIF(logo_url, ''), updated_at = now()
  WHERE id = 1;
END;
$$;

-- Admin: read the logo
CREATE OR REPLACE FUNCTION public.admin_get_site_logo(input_pin text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT logo_url FROM site_settings WHERE id = 1;
$$;

-- Public: read the logo for display on any page
CREATE OR REPLACE FUNCTION public.get_site_logo()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT logo_url FROM site_settings WHERE id = 1;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_site_logo(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_site_logo(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_site_logo() TO anon, authenticated;
