-- Function to look up a user's auth email by username
-- Used during login so users can log in with their username instead of email
-- SECURITY DEFINER so it works before the user is authenticated
-- Only returns the email, nothing else

CREATE OR REPLACE FUNCTION public.get_email_by_username(p_username text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM profiles WHERE username = p_username LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_email_by_username(text) TO anon, authenticated;
