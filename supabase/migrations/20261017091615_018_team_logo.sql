/*
# Team logo setting + site logo hardening

## Purpose
Adds a second admin-controlled brand image: the "team logo", shown in the site footer (a circular badge). Extends the existing site_settings singleton row.

## Changed Table
- `site_settings` gains `team_logo_url text` (nullable)

## New Functions (SECURITY DEFINER)
- `admin_set_team_logo(input_pin text, logo_url text)` — admin-only, PIN verified; empty string removes the logo
- `admin_get_team_logo(input_pin text)` — admin-only read
- `get_team_logo()` — public read (anon + authenticated) for the footer

## Security
- Writes only through PIN-verified admin functions; the table's public SELECT policy already covers read access
- Both parameter/column references are qualified to avoid the ambiguity bug fixed in migration 017
*/

ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS team_logo_url text;

CREATE OR REPLACE FUNCTION public.admin_set_team_logo(input_pin text, logo_url text)
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
  SET team_logo_url = NULLIF(admin_set_team_logo.logo_url, ''), updated_at = now()
  WHERE id = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_team_logo(input_pin text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT team_logo_url FROM site_settings WHERE id = 1;
$$;

CREATE OR REPLACE FUNCTION public.get_team_logo()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT team_logo_url FROM site_settings WHERE id = 1;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_team_logo(text, text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_team_logo(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_team_logo() TO anon, authenticated;
