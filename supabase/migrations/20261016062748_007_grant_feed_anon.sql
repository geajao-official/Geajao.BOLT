/*
# Grant feed function to anon role as well

The Supabase JS client may resolve to the anon role in some cases.
Grant execute to both anon and authenticated to ensure the RPC works.
*/

GRANT EXECUTE ON FUNCTION get_feed_posts(integer) TO anon, authenticated;
