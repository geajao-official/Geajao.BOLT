/*
# Real-time chat system (friends only)

## Purpose
Adds direct 1-to-1 real-time messaging between verified friends. Admins have no access to chat content.

## New Tables
- `conversations`
  - `id` (uuid, PK)
  - `user1_id` (uuid, FK -> auth.users) — the user with the lexicographically smaller id
  - `user2_id` (uuid, FK -> auth.users) — the user with the lexicographically larger id
  - `created_at` (timestamptz)
  - Unique constraint on (user1_id, user2_id) so only one conversation per pair

- `messages`
  - `id` (uuid, PK)
  - `conversation_id` (uuid, FK -> conversations, ON DELETE CASCADE)
  - `sender_id` (uuid, FK -> auth.users, DEFAULT auth.uid())
  - `content` (text, NOT NULL) — message text
  - `read_at` (timestamptz, nullable) — when the recipient read the message
  - `created_at` (timestamptz, DEFAULT now())

## New Functions (SECURITY DEFINER)
- `get_or_create_conversation(p_friend_id uuid)` — finds or creates a conversation between auth.uid() and the friend, verifying they are actually friends
- `get_conversations()` — returns all conversations for the current user with the other person's info and last message preview
- `get_messages(p_conversation_id uuid)` — returns all messages in a conversation (only if the user is a participant)
- `mark_messages_read(p_conversation_id uuid)` — marks all messages in a conversation as read by the recipient

## Security
- RLS enabled on both `conversations` and `messages`
- Users can only see conversations where they are a participant
- Users can only insert messages into conversations they belong to
- Users can only update `read_at` on messages sent to them
- All conversation creation goes through a SECURITY DEFINER function that verifies friendship
- Admin functions have NO access to chat tables — chat is private between friends
*/

-- ============================================
-- Conversations table
-- ============================================

CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user2_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT user1_less_than_user2 CHECK (user1_id < user2_id),
  UNIQUE(user1_id, user2_id)
);

CREATE INDEX IF NOT EXISTS idx_conversations_user1 ON conversations(user1_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user2 ON conversations(user2_id);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_conversations" ON conversations;
CREATE POLICY "select_own_conversations"
  ON conversations FOR SELECT
  TO authenticated
  USING (auth.uid() = user1_id OR auth.uid() = user2_id);

DROP POLICY IF EXISTS "insert_own_conversations" ON conversations;
CREATE POLICY "insert_own_conversations"
  ON conversations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user1_id OR auth.uid() = user2_id);

DROP POLICY IF EXISTS "delete_own_conversations" ON conversations;
CREATE POLICY "delete_own_conversations"
  ON conversations FOR DELETE
  TO authenticated
  USING (auth.uid() = user1_id OR auth.uid() = user2_id);

-- ============================================
-- Messages table
-- ============================================

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Users can only see messages in conversations they are part of
DROP POLICY IF EXISTS "select_own_messages" ON messages;
CREATE POLICY "select_own_messages"
  ON messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
        AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
    )
  );

-- Users can only send messages in conversations they are part of
DROP POLICY IF EXISTS "insert_own_messages" ON messages;
CREATE POLICY "insert_own_messages"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
        AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
    )
  );

-- Users can only update read_at on messages sent to them (not their own)
DROP POLICY IF EXISTS "update_own_messages" ON messages;
CREATE POLICY "update_own_messages"
  ON messages FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
        AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
        AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "delete_own_messages" ON messages;
CREATE POLICY "delete_own_messages"
  ON messages FOR DELETE
  TO authenticated
  USING (auth.uid() = sender_id);

-- ============================================
-- Chat functions (SECURITY DEFINER)
-- ============================================

-- Get or create a conversation with a friend
CREATE OR REPLACE FUNCTION public.get_or_create_conversation(p_friend_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv_id uuid;
  v_user1 uuid;
  v_user2 uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF auth.uid() = p_friend_id THEN
    RAISE EXCEPTION 'Cannot create conversation with yourself';
  END IF;

  -- Verify they are friends
  IF NOT EXISTS (
    SELECT 1 FROM friendships
    WHERE status = 'accepted'
      AND (
        (requester_id = auth.uid() AND addressee_id = p_friend_id)
        OR (requester_id = p_friend_id AND addressee_id = auth.uid())
      )
  ) THEN
    RAISE EXCEPTION 'You can only chat with friends';
  END IF;

  -- Determine ordering (user1 < user2 by uuid)
  IF auth.uid() < p_friend_id THEN
    v_user1 := auth.uid();
    v_user2 := p_friend_id;
  ELSE
    v_user1 := p_friend_id;
    v_user2 := auth.uid();
  END IF;

  -- Try to find existing conversation
  SELECT id INTO v_conv_id
  FROM conversations
  WHERE user1_id = v_user1 AND user2_id = v_user2
  LIMIT 1;

  IF v_conv_id IS NULL THEN
    INSERT INTO conversations (user1_id, user2_id)
    VALUES (v_user1, v_user2)
    RETURNING id INTO v_conv_id;
  END IF;

  RETURN v_conv_id;
END;
$$;

-- Get all conversations for the current user
CREATE OR REPLACE FUNCTION public.get_conversations()
RETURNS TABLE (
  conversation_id uuid,
  friend_id uuid,
  friend_name text,
  friend_username text,
  last_message text,
  last_message_at timestamptz,
  unread_count bigint
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
    c.id AS conversation_id,
    CASE WHEN c.user1_id = auth.uid() THEN c.user2_id ELSE c.user1_id END AS friend_id,
    p.full_name AS friend_name,
    p.username AS friend_username,
    (SELECT m.content FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_message,
    (SELECT m.created_at FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_message_at,
    (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.sender_id != auth.uid() AND m.read_at IS NULL) AS unread_count
  FROM conversations c
  JOIN profiles p ON p.id = (
    CASE WHEN c.user1_id = auth.uid() THEN c.user2_id ELSE c.user1_id END
  )
  WHERE c.user1_id = auth.uid() OR c.user2_id = auth.uid()
  ORDER BY last_message_at DESC NULLS LAST;
END;
$$;

-- Get messages for a conversation (only if participant)
CREATE OR REPLACE FUNCTION public.get_messages(p_conversation_id uuid)
RETURNS TABLE (
  message_id uuid,
  sender_id uuid,
  content text,
  read_at timestamptz,
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

  IF NOT EXISTS (
    SELECT 1 FROM conversations
    WHERE id = p_conversation_id
      AND (user1_id = auth.uid() OR user2_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'Not authorized to view this conversation';
  END IF;

  RETURN QUERY
  SELECT
    m.id AS message_id,
    m.sender_id,
    m.content,
    m.read_at,
    m.created_at
  FROM messages m
  WHERE m.conversation_id = p_conversation_id
  ORDER BY m.created_at ASC;
END;
$$;

-- Mark all unread messages in a conversation as read
CREATE OR REPLACE FUNCTION public.mark_messages_read(p_conversation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE messages
  SET read_at = now()
  WHERE conversation_id = p_conversation_id
    AND sender_id != auth.uid()
    AND read_at IS NULL
    AND EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = p_conversation_id
        AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_or_create_conversation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_conversations() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_messages(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_messages_read(uuid) TO authenticated;

-- Enable realtime on messages table
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
