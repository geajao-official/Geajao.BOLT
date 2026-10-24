/*
# Show avatars in chat conversation list

1. Modified Functions
- `get_conversations()`: dropped and recreated, now also returns `friend_avatar_url` (text) so the chat list shows profile pictures.

2. Security
- Same SECURITY DEFINER function and access rules. Only the public avatar_url column is added; email/phone/id_card_url remain excluded.

3. Important Notes
- Function dropped first because Postgres cannot change a return type in place.
- No table data touched.
*/

DROP FUNCTION IF EXISTS public.get_conversations();
CREATE FUNCTION public.get_conversations()
RETURNS TABLE (
  conversation_id uuid,
  friend_id uuid,
  friend_name text,
  friend_username text,
  friend_avatar_url text,
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
    p.avatar_url AS friend_avatar_url,
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

GRANT EXECUTE ON FUNCTION public.get_conversations() TO authenticated;
