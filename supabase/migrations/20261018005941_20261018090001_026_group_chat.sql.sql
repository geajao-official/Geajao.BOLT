/*
# Group chat

1. New Tables
- `chat_groups`: one row per group conversation.
  - `id` (uuid, primary key)
  - `name` (text, 1-50 chars)
  - `created_by` (uuid, references profiles, the group creator)
  - `created_at`
- `chat_group_members`: who is in each group.
  - `group_id` (uuid, references chat_groups, cascade delete)
  - `user_id` (uuid, references profiles, cascade delete)
  - `joined_at`
  - primary key (group_id, user_id)
- `chat_group_messages`: messages in a group.
  - `id` (uuid, primary key)
  - `group_id` (uuid, references chat_groups, cascade delete)
  - `sender_id` (uuid, references profiles)
  - `content` (text, 1-2000 chars)
  - `created_at`

2. Security
- RLS enabled on all three tables.
- Members can read a group, its member list, and its messages. Only members can send messages.
- Group creation goes through `create_chat_group(name, member_ids)` — SECURITY DEFINER, verifies all members are accepted friends of the creator, inserts the creator as a member automatically.
- `get_chat_groups()` — returns groups the caller belongs to with name, member count, last message preview and unread count (messages newer than my last own message).
- `get_chat_group_members(group_id)` — member list with names/avatars; membership verified.
- `get_chat_group_messages(group_id)` — messages; membership verified.
- `send_chat_group_message(group_id, content)` — membership verified, trims input.
- `leave_chat_group(group_id)` — a member can leave; the creator leaving deletes the whole group.

3. Important Notes
- Member count capped: creator + up to 19 friends.
- No direct client inserts on chat_groups or chat_group_members: only through functions.
*/

-- 1. Tables
CREATE TABLE IF NOT EXISTS chat_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 50),
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_group_members (
  group_id uuid NOT NULL REFERENCES chat_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS chat_group_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES chat_groups(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cgm_messages ON chat_group_messages(group_id, created_at);
CREATE INDEX IF NOT EXISTS idx_cgm_members_user ON chat_group_members(user_id);

-- 2. RLS
ALTER TABLE chat_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_group_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "groups_select_member" ON chat_groups;
CREATE POLICY "groups_select_member" ON chat_groups
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM chat_group_members m WHERE m.group_id = chat_groups.id AND m.user_id = auth.uid()));

DROP POLICY IF EXISTS "group_members_select_member" ON chat_group_members;
CREATE POLICY "group_members_select_member" ON chat_group_members
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM chat_group_members m2 WHERE m2.group_id = chat_group_members.group_id AND m2.user_id = auth.uid()));

DROP POLICY IF EXISTS "group_messages_select_member" ON chat_group_messages;
CREATE POLICY "group_messages_select_member" ON chat_group_messages
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM chat_group_members m WHERE m.group_id = chat_group_messages.group_id AND m.user_id = auth.uid()));

DROP POLICY IF EXISTS "group_messages_insert_member" ON chat_group_messages;
CREATE POLICY "group_messages_insert_member" ON chat_group_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (SELECT 1 FROM chat_group_members m WHERE m.group_id = chat_group_messages.group_id AND m.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "group_members_delete_self" ON chat_group_members;
CREATE POLICY "group_members_delete_self" ON chat_group_members
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 3. Functions
CREATE OR REPLACE FUNCTION public.create_chat_group(
  p_name text,
  p_member_ids uuid[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group_id uuid;
  v_member uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF char_length(trim(p_name)) = 0 OR char_length(p_name) > 50 THEN
    RAISE EXCEPTION 'Group name must be 1-50 characters';
  END IF;

  IF array_length(p_member_ids, 1) IS NULL OR array_length(p_member_ids, 1) > 19 THEN
    RAISE EXCEPTION 'Group can have at most 19 friends plus you';
  END IF;

  FOREACH v_member IN ARRAY p_member_ids LOOP
    IF v_member = auth.uid() THEN
      CONTINUE;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM friendships f
      WHERE f.status = 'accepted'
        AND ((f.requester_id = auth.uid() AND f.addressee_id = v_member)
          OR (f.addressee_id = auth.uid() AND f.requester_id = v_member))
    ) THEN
      RAISE EXCEPTION 'All members must be your friends';
    END IF;
  END LOOP;

  INSERT INTO chat_groups (name, created_by)
  VALUES (trim(p_name), auth.uid())
  RETURNING id INTO v_group_id;

  INSERT INTO chat_group_members (group_id, user_id)
  VALUES (v_group_id, auth.uid());

  FOREACH v_member IN ARRAY p_member_ids LOOP
    IF v_member != auth.uid() THEN
      INSERT INTO chat_group_members (group_id, user_id)
      VALUES (v_group_id, v_member)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  RETURN v_group_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_chat_groups()
RETURNS TABLE (
  group_id uuid,
  name text,
  member_count bigint,
  last_message text,
  last_message_at timestamptz,
  unread_count bigint,
  created_by uuid
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    g.id,
    g.name,
    (SELECT count(*) FROM chat_group_members m WHERE m.group_id = g.id),
    (SELECT msg.content FROM chat_group_messages msg WHERE msg.group_id = g.id ORDER BY msg.created_at DESC LIMIT 1),
    (SELECT msg.created_at FROM chat_group_messages msg WHERE msg.group_id = g.id ORDER BY msg.created_at DESC LIMIT 1),
    (SELECT count(*) FROM chat_group_messages msg
      WHERE msg.group_id = g.id AND msg.sender_id != auth.uid() AND msg.created_at > (
        SELECT COALESCE(max(prev.created_at), to_timestamp(0))
        FROM chat_group_messages prev
        WHERE prev.group_id = g.id AND prev.sender_id = auth.uid()
      )),
    g.created_by
  FROM chat_groups g
  JOIN chat_group_members m ON m.group_id = g.id AND m.user_id = auth.uid()
  ORDER BY (SELECT msg.created_at FROM chat_group_messages msg WHERE msg.group_id = g.id ORDER BY msg.created_at DESC LIMIT 1) DESC NULLS LAST;
$$;

CREATE OR REPLACE FUNCTION public.get_chat_group_members(p_group_id uuid)
RETURNS TABLE (
  user_id uuid,
  full_name text,
  username text,
  avatar_url text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.user_id, p.full_name, p.username, p.avatar_url
  FROM chat_group_members m
  JOIN profiles p ON p.id = m.user_id
  WHERE m.group_id = p_group_id
    AND EXISTS (SELECT 1 FROM chat_group_members me WHERE me.group_id = p_group_id AND me.user_id = auth.uid())
  ORDER BY p.full_name;
$$;

CREATE OR REPLACE FUNCTION public.get_chat_group_messages(p_group_id uuid)
RETURNS TABLE (
  message_id uuid,
  sender_id uuid,
  content text,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT msg.id, msg.sender_id, msg.content, msg.created_at
  FROM chat_group_messages msg
  WHERE msg.group_id = p_group_id
    AND EXISTS (SELECT 1 FROM chat_group_members me WHERE me.group_id = p_group_id AND me.user_id = auth.uid())
  ORDER BY msg.created_at ASC;
$$;

CREATE OR REPLACE FUNCTION public.send_chat_group_message(p_group_id uuid, p_content text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM chat_group_members WHERE group_id = p_group_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Not a member of this group';
  END IF;
  IF char_length(trim(p_content)) = 0 OR char_length(p_content) > 2000 THEN
    RAISE EXCEPTION 'Message must be 1-2000 characters';
  END IF;

  INSERT INTO chat_group_messages (group_id, sender_id, content)
  VALUES (p_group_id, auth.uid(), trim(p_content));
END;
$$;

CREATE OR REPLACE FUNCTION public.leave_chat_group(p_group_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM chat_group_members WHERE group_id = p_group_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Not a member of this group';
  END IF;

  IF EXISTS (SELECT 1 FROM chat_groups WHERE id = p_group_id AND created_by = auth.uid()) THEN
    DELETE FROM chat_groups WHERE id = p_group_id;
  ELSE
    DELETE FROM chat_group_members WHERE group_id = p_group_id AND user_id = auth.uid();
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_chat_group(text, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_chat_groups() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_chat_group_members(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_chat_group_messages(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_chat_group_message(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_chat_group(uuid) TO authenticated;
