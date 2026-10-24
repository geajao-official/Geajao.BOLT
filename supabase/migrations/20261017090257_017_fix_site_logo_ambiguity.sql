/*
# Fix ambiguous column reference in admin_set_site_logo

## Purpose
The previous version of `admin_set_site_logo` failed at runtime with
"column reference logo_url is ambiguous" because the function parameter
`logo_url` collided with the `site_settings.logo_url` column inside the
UPDATE statement. This made logo uploads appear broken (file uploaded,
setting never saved). Qualify the parameter with the function name.

## Changed Functions
- `admin_set_site_logo(input_pin text, logo_url text)` — same signature, fixed UPDATE
*/

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
  SET logo_url = NULLIF(admin_set_site_logo.logo_url, ''), updated_at = now()
  WHERE id = 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_site_logo(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_site_logo(text, text) TO anon;
