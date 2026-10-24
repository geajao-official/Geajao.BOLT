/*
# Friendships table + Account Deletion (user & admin)

## Purpose
Adds a friend request/accept/reject system and the ability for users to delete their own account and admins to delete any user's account.

## New Tables
- `friendships`
  - `id` (uuid, PK)
  - `requester_id` (uuid, FK -> auth.users, the user who sent the request)
  - `addressee_id` (uuid, FK -> auth.users, the user who receives the request)
  - `status` (enum: 'pending', 'accepted', 'declined', default 'pending')
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)
  - Unique constraint on (requester_id, addressee_id) to prevent duplicate requests

## New Functions (SECURITY DEFINER)
- `send_friend_request(p_addressee_id uuid)` — creates a pending friendship from auth.uid() to addressee
- `accept_friend_request(p_requester_id uuid)` — accepts a pending request where auth.uid() is the addressee
- `decline_friend_request(p_requester_id uuid)` — declines/removes a pending request
- `remove_friend(p_friend_id uuid)` — removes an accepted friendship (either party can remove)
- `get_friend_requests()` — returns pending requests for the current user (incoming)
- `get_sent_requests()` — returns pending requests sent by the current user (outgoing)
- `get_friends()` — returns accepted friends of the current user
- `get_friendship_status(p_other_user_id uuid)` — returns the friendship status between current user and another user
- `delete_own_account()` — deletes the current user's profile, posts, friendships, and auth.users entry
- `admin_delete_user(p_pin text, p_user_id uuid)` — admin function to delete any user's account

## Security
- RLS enabled on `friendships`
- Users can only see/manage friendships where they are involved
- All friendship actions go through SECURITY DEFINER functions
- Account deletion functions are SECURITY DEFINER to cascade-delete related data
- Admin deletion requires PIN verification
*/

-- ============================================
-- Friendship status enum (conditional create)
-- ============================================

DO $$ BEGIN
  CREATE TYPE friendship_status AS ENUM ('pending', 'accepted', 'declined');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- Friendships table
-- ============================================

CREATE TABLE IF NOT EXISTS friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status friendship_status NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(requester_id, addressee_id)
);

CREATE INDEX IF NOT EXISTS idx_friendships_requester ON friendships(requester_id);
CREATE INDEX IF NOT EXISTS idx_friendships_addressee ON friendships(addressee_id);
CREATE INDEX IF NOT EXISTS idx_friendships_status ON friendships(status);

ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_friendships" ON friendships;
CREATE POLICY "select_own_friendships"
  ON friendships FOR SELECT
  TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

DROP POLICY IF EXISTS "insert_own_friendships" ON friendships;
CREATE POLICY "insert_own_friendships"
  ON friendships FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = requester_id);

DROP POLICY IF EXISTS "update_own_friendships" ON friendships;
CREATE POLICY "update_own_friendships"
  ON friendships FOR UPDATE
  TO authenticated
  USING (auth.uid() = addressee_id OR auth.uid() = requester_id)
  WITH CHECK (auth.uid() = addressee_id OR auth.uid() = requester_id);

DROP POLICY IF EXISTS "delete_own_friendships" ON friendships;
CREATE POLICY "delete_own_friendships"
  ON friendships FOR DELETE
  TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- ============================================
-- Friend system functions (SECURITY DEFINER)
-- ============================================

CREATE OR REPLACE FUNCTION public.send_friend_request(p_addressee_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF auth.uid() = p_addressee_id THEN
    RAISE EXCEPTION 'Cannot send friend request to yourself';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_addressee_id AND verification_status = 'verified') THEN
    RAISE EXCEPTION 'User not found or not verified';
  END IF;

  IF EXISTS (
    SELECT 1 FROM friendships
    WHERE (requester_id = auth.uid() AND addressee_id = p_addressee_id)
       OR (requester_id = p_addressee_id AND addressee_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'Friendship already exists or is pending';
  END IF;

  INSERT INTO friendships (requester_id, addressee_id, status)
  VALUES (auth.uid(), p_addressee_id, 'pending');
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_friend_request(p_requester_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE friendships
  SET status = 'accepted', updated_at = now()
  WHERE requester_id = p_requester_id
    AND addressee_id = auth.uid()
    AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Friend request not found';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.decline_friend_request(p_requester_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  DELETE FROM friendships
  WHERE requester_id = p_requester_id
    AND addressee_id = auth.uid()
    AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Friend request not found';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_friend(p_friend_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  DELETE FROM friendships
  WHERE status = 'accepted'
    AND (
      (requester_id = auth.uid() AND addressee_id = p_friend_id)
      OR (requester_id = p_friend_id AND addressee_id = auth.uid())
    );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Friendship not found';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_friend_requests()
RETURNS TABLE (
  requester_id uuid,
  requester_name text,
  requester_username text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  SELECT
    f.requester_id,
    p.full_name,
    p.username,
    f.created_at
  FROM friendships f
  JOIN profiles p ON p.id = f.requester_id
  WHERE f.addressee_id = auth.uid()
    AND f.status = 'pending'
  ORDER BY f.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_sent_requests()
RETURNS TABLE (
  addressee_id uuid,
  addressee_name text,
  addressee_username text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  SELECT
    f.addressee_id,
    p.full_name,
    p.username,
    f.created_at
  FROM friendships f
  JOIN profiles p ON p.id = f.addressee_id
  WHERE f.requester_id = auth.uid()
    AND f.status = 'pending'
  ORDER BY f.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_friends()
RETURNS TABLE (
  friend_id uuid,
  friend_name text,
  friend_username text,
  since timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  SELECT
    CASE WHEN f.requester_id = auth.uid() THEN f.addressee_id ELSE f.requester_id END AS friend_id,
    p.full_name AS friend_name,
    p.username AS friend_username,
    f.updated_at AS since
  FROM friendships f
  JOIN profiles p ON p.id = (
    CASE WHEN f.requester_id = auth.uid() THEN f.addressee_id ELSE f.requester_id END
  )
  WHERE (f.requester_id = auth.uid() OR f.addressee_id = auth.uid())
    AND f.status = 'accepted'
  ORDER BY p.full_name;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_friendship_status(p_other_user_id uuid)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN 'none';
  END IF;

  SELECT
    CASE
      WHEN requester_id = auth.uid() THEN status::text || '_outgoing'
      WHEN addressee_id = auth.uid() THEN status::text || '_incoming'
      ELSE status::text
    END
  INTO v_status
  FROM friendships
  WHERE (requester_id = auth.uid() AND addressee_id = p_other_user_id)
     OR (requester_id = p_other_user_id AND addressee_id = auth.uid())
  LIMIT 1;

  RETURN COALESCE(v_status, 'none');
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_friend_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_friend_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decline_friend_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_friend(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_friend_requests() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_sent_requests() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_friends() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_friendship_status(uuid) TO authenticated;

-- ============================================
-- Account deletion functions
-- ============================================

CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  DELETE FROM friendships WHERE requester_id = v_user_id OR addressee_id = v_user_id;
  DELETE FROM posts WHERE user_id = v_user_id;
  DELETE FROM profiles WHERE id = v_user_id;
  DELETE FROM auth.users WHERE id = v_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_delete_user(p_pin text, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_valid boolean;
BEGIN
  SELECT verify_admin_pin(p_pin) INTO v_is_valid;
  IF NOT v_is_valid THEN
    RAISE EXCEPTION 'Invalid admin PIN';
  END IF;

  DELETE FROM friendships WHERE requester_id = p_user_id OR addressee_id = p_user_id;
  DELETE FROM posts WHERE user_id = p_user_id;
  DELETE FROM profiles WHERE id = p_user_id;
  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_user(text, uuid) TO authenticated, anon;
