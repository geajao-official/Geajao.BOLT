/*
# User badges (Admin / Cadet / Ex-Cadet) + badge-circle feed

1. New Columns
- `profiles.badge` (text, nullable): one of 'admin', 'cadet', 'ex_cadet', or NULL for no badge. Set by the admin via the Admin Panel.

2. New / Recreated Functions (SECURITY DEFINER)
- `admin_set_badge(input_pin, target_user_id, new_badge)`: PIN-protected. Sets or clears a user's badge; validates the badge value; empty string clears it.
- `admin_get_all_profiles` recreated to also return the `badge` column.
- `get_feed_posts` recreated to also return `author_badge`, and to accept a `badge_filter` parameter:
  - NULL or 'all' → all posts (previous behavior)
  - 'admin' | 'cadet' | 'ex_cadet' → only posts by users holding that badge
  - 'badge_holders' → posts by anyone holding any badge
- `get_my_badge()`: returns the caller's own badge (or NULL).

3. Security
- No new tables; only a nullable column on profiles. Profiles SELECT is already open to authenticated users (migration 009), so badges are visible in the feed.
- Admin functions remain PIN-gated. `admin_get_all_profiles` and `get_feed_posts` are recreated because their return shapes change.
- Badge-circle filtering is read-side, enforced inside the SECURITY DEFINER function rather than client-side filtering.

4. Important Notes
- Badge values: 'admin', 'cadet', 'ex_cadet'. NULL = no badge.
- The badge chip shows next to names in the feed, on profiles, and in the sidebar.
*/

-- 1. Badge column on profiles
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'badge'
  ) THEN
    ALTER TABLE profiles ADD COLUMN badge text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_badge_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_badge_check
      CHECK (badge IN ('admin', 'cadet', 'ex_cadet'));
  END IF;
END $$;

-- 2. Admin: set badge (PIN-protected)
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
     AND new_badge NOT IN ('admin', 'cadet', 'ex_cadet') THEN
    RAISE EXCEPTION 'Invalid badge';
  END IF;

  UPDATE profiles
  SET badge = CASE WHEN char_length(COALESCE(new_badge, '')) = 0 THEN NULL ELSE new_badge END,
      updated_at = now()
  WHERE id = target_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_set_badge(text, uuid, text) TO anon, authenticated;

-- 3. Admin: profile list now includes badge
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
  badge text
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
           p.restricted_until, p.created_at, p.badge
    FROM profiles p
    ORDER BY p.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_get_all_profiles(text) TO anon, authenticated;

-- 4. Feed with badge info + badge-circle filter
DROP FUNCTION IF EXISTS get_feed_posts(integer);

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
  author_badge text
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
           pr.badge AS author_badge
    FROM posts p
    LEFT JOIN profiles pr ON pr.id = p.user_id
    WHERE p.is_removed = false
      AND (
        badge_filter IS NULL OR badge_filter = 'all'
        OR (badge_filter = 'badge_holders' AND pr.badge IS NOT NULL)
        OR (badge_filter IN ('admin', 'cadet', 'ex_cadet') AND pr.badge = badge_filter)
      )
    ORDER BY p.created_at DESC
    LIMIT limit_count;
END;
$$;

GRANT EXECUTE ON FUNCTION get_feed_posts(integer, text) TO anon, authenticated;

-- 5. Caller's own badge
CREATE OR REPLACE FUNCTION get_my_badge()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT badge FROM profiles WHERE id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION get_my_badge() TO authenticated;
