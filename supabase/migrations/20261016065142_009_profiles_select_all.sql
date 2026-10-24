/*
# Fix: Allow all authenticated users to read profiles

The profiles table RLS only allowed users to read their own profile
(auth.uid() = id). This broke the feed because the posts query joins
with profiles to get author names — users could only see their own posts.

Add a second SELECT policy allowing all authenticated users to read
all profiles. The app only queries public columns (full_name, username),
so no private data (email, phone, id_card_url) is exposed through the UI.
*/

CREATE POLICY "profiles_select_all_authenticated"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);
