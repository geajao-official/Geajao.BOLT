/*
  # Separate is_admin flag from Cadet/Ex-Cadet badge

  Prior to this change, `profiles.badge` held one of 'admin' | 'cadet' | 'ex_cadet' | NULL, so
  "admin" was just another badge value. This made admin status and a vanity badge the same column,
  which conflated two unrelated concepts and blocked the UI from showing an Admin chip alongside a
  Cadet/Ex-Cadet badge for the same person.

  This migration splits them:
  - `profiles.is_admin` (boolean, not null, default false): the real admin flag. Admin status is no
    longer derived from a badge value.
  - `profiles.badge` keeps its meaning but is restricted to the vanity badges: 'cadet' | 'ex_cadet'
    | NULL. The 'admin' value is removed from the CHECK constraint.

  Migration of existing rows: any profile whose badge was 'admin' has is_admin set to true and its
  badge cleared (badge -> NULL), so no data is lost and the admin chip continues to render.

  Functions updated:
  - `admin_set_badge`: only accepts 'cadet' | 'ex_cadet' | '' (clear). 'admin' is rejected.
  - `admin_set_admin` (NEW): PIN-protected toggle of is_admin for a user.
  - `admin_get_all_profiles`: returns is_admin in addition to badge.
  - `get_my_badge`: unchanged in shape; still returns the caller's badge (cadet/ex_cadet/null).
  - `get_my_is_admin` (NEW): returns the caller's is_admin flag.
  - `get_feed_posts`: adds author_is_admin to the return shape; badge-circle filter keys off badge
    only (cadet/ex_cadet), not admin. Admin status is shown alongside the badge in the UI.
  - `get_public_profile`: adds is_admin to the return shape.

  RLS / column privileges:
  - is_admin is a privilege flag, never client-writable. We revoke the column from UPDATE on
    authenticated and rely on `admin_set_admin` (SECURITY DEFINER, PIN-gated) for legitimate
    changes. badge is also already admin-managed via `admin_set_badge`; we revoke UPDATE on it too
    so a user cannot self-assign a Cadet/Ex-Cadet badge through the data API.
  - No SELECT policy changes: profiles SELECT is already open to authenticated users (migration 009),
    and is_admin is non-sensitive display metadata (admin chip), so it stays readable.
*/

-- 1. Add is_admin column
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'is_admin'
  ) THEN
    ALTER TABLE profiles ADD COLUMN is_admin boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- 2. Migrate existing 'admin' badge holders to is_admin = true, clear their badge
UPDATE profiles SET is_admin = true, badge = NULL, updated_at = now()
WHERE badge = 'admin';

-- 3. Narrow the badge CHECK constraint to cadet / ex_cadet only
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_badge_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE profiles DROP CONSTRAINT profiles_badge_check;
  END IF;
END $$;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_badge_check CHECK (badge IN ('cadet', 'ex_cadet'));

-- 4. Revoke client UPDATE on is_admin and badge columns (privilege / moderation fields)
REVOKE UPDATE ON profiles FROM authenticated;
-- Re-grant UPDATE on user-editable columns only. Keep this list in sync with the profile
-- columns a user is allowed to edit directly. is_admin and badge are intentionally excluded.
GRANT UPDATE (full_name, phone, avatar_url, id_card_url) ON profiles TO authenticated;

-- 5. admin_set_badge: cadet / ex_cadet only
CREATE OR REPLACE FUNCTION admin_set_badge(
  input_pin text,
  target_user_id uuid,
  new_badge text
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

  IF new_badge IS NOT NULL AND char_length(new_badge) > 0
     AND new_badge NOT IN ('cadet', 'ex_cadet') THEN
    RAISE EXCEPTION 'Invalid badge';
  END IF;

  UPDATE profiles
  SET badge = CASE WHEN char_length(COALESCE(new_badge, '')) = 0 THEN NULL ELSE new_badge END,
      updated_at = now()
  WHERE id = target_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_set_badge(text, uuid, text) TO anon, authenticated;

-- 6. admin_set_admin: PIN-protected toggle of is_admin
CREATE OR REPLACE FUNCTION admin_set_admin(
  input_pin text,
  target_user_id uuid,
  is_admin boolean
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

  UPDATE profiles
  SET is_admin = is_admin,
      updated_at = now()
  WHERE id = target_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_set_admin(text, uuid, boolean) TO anon, authenticated;

-- 7. admin_get_all_profiles: include is_admin
DROP FUNCTION IF EXISTS admin_get_all_profiles(text);

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
  created_at timestamptz,
  badge text,
  is_admin boolean
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
    SELECT p.id, p.username, p.full_name, p.email, p.phone,
           p.verification_status, p.id_card_url, p.is_blocked,
           p.restricted_until, p.created_at, p.badge, p.is_admin
    FROM profiles p
    ORDER BY p.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_get_all_profiles(text) TO anon, authenticated;

-- 8. get_my_is_admin: caller's own admin flag
CREATE OR REPLACE FUNCTION get_my_is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT is_admin FROM profiles WHERE id = auth.uid()), false);
$$;

GRANT EXECUTE ON FUNCTION get_my_is_admin() TO authenticated;

-- 9. get_feed_posts: include author_is_admin; badge filter keys off cadet/ex_cadet only
DROP FUNCTION IF EXISTS get_feed_posts(integer);
DROP FUNCTION IF EXISTS get_feed_posts(integer, text);

CREATE OR REPLACE FUNCTION get_feed_posts(
  limit_count integer DEFAULT 50,
  badge_filter text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  content_type content_type_enum,
  text_content text,
  media_url text,
  is_removed boolean,
  created_at timestamptz,
  author_name text,
  author_username text,
  author_avatar_url text,
  author_badge text,
  author_is_admin boolean,
  audience text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    SELECT p.id, p.user_id, p.content_type, p.text_content, p.media_url,
           p.is_removed, p.created_at,
           pr.full_name AS author_name,
           pr.username AS author_username,
           pr.avatar_url AS author_avatar_url,
           pr.badge AS author_badge,
           pr.is_admin AS author_is_admin,
           p.audience
    FROM posts p
    LEFT JOIN profiles pr ON pr.id = p.user_id
    WHERE p.is_removed = false
      AND (
        p.audience = 'public'
        OR (p.user_id = auth.uid())
        OR (
          p.audience = 'badge'
          AND pr.badge IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM profiles me
            WHERE me.id = auth.uid() AND me.badge = pr.badge
          )
        )
      )
      AND (
        badge_filter IS NULL OR badge_filter = 'all'
        OR (badge_filter = 'badge_holders' AND pr.badge IS NOT NULL AND p.audience = 'badge')
        OR (badge_filter IN ('cadet', 'ex_cadet') AND pr.badge = badge_filter AND p.audience = 'badge')
      )
    ORDER BY p.created_at DESC
    LIMIT limit_count;
END;
$$;

GRANT EXECUTE ON FUNCTION get_feed_posts(integer, text) TO anon, authenticated;

-- 10. get_public_profile: include is_admin
DROP FUNCTION IF EXISTS public.get_public_profile(uuid);

CREATE OR REPLACE FUNCTION public.get_public_profile(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  username text,
  full_name text,
  verification_status verification_status_enum,
  created_at timestamptz,
  friend_count bigint,
  avatar_url text,
  badge text,
  is_admin boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.username,
    p.full_name,
    p.verification_status,
    p.created_at,
    (SELECT count(*)::bigint FROM friendships f
      WHERE f.status = 'accepted'
        AND (f.requester_id = p.id OR f.addressee_id = p.id)),
    p.avatar_url,
    p.badge,
    p.is_admin
  FROM profiles p
  WHERE p.id = p_user_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_profile(uuid) TO authenticated;
