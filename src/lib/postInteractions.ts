import { supabase } from '@/lib/supabase';
import { PostComment, ReactionType, ReactionSummary } from '@/types';

const EMPTY_COUNTS: Record<ReactionType, number> = {
  like: 0,
  love: 0,
  laugh: 0,
  wow: 0,
  sad: 0,
};

export async function getReactionSummary(
  postIds: string[],
  currentUserId?: string
): Promise<Record<string, ReactionSummary>> {
  if (postIds.length === 0) return {};
  const { data, error } = await supabase
    .from('post_reactions')
    .select('post_id, user_id, reaction')
    .in('post_id', postIds);

  if (error) throw error;

  const result: Record<string, ReactionSummary> = {};
  for (const postId of postIds) {
    result[postId] = { counts: { ...EMPTY_COUNTS }, mine: null };
  }
  for (const row of (data as { post_id: string; user_id: string; reaction: ReactionType }[]) || []) {
    const summary = result[row.post_id];
    if (!summary) continue;
    summary.counts[row.reaction] = (summary.counts[row.reaction] || 0) + 1;
    if (currentUserId && row.user_id === currentUserId) {
      summary.mine = row.reaction;
    }
  }
  return result;
}

export async function getMyReaction(postId: string): Promise<ReactionType | null> {
  const { data, error } = await supabase
    .from('post_reactions')
    .select('reaction')
    .eq('post_id', postId)
    .maybeSingle();
  if (error) throw error;
  return (data?.reaction as ReactionType) ?? null;
}

export async function setMyReaction(postId: string, reaction: ReactionType | null): Promise<void> {
  if (reaction === null) {
    const { error } = await supabase.from('post_reactions').delete().eq('post_id', postId);
    if (error) throw error;
    return;
  }
  const { error } = await supabase
    .from('post_reactions')
    .upsert({ post_id: postId, reaction }, { onConflict: 'post_id,user_id' });
  if (error) throw error;
}

export async function getComments(postId: string): Promise<PostComment[]> {
  const { data, error } = await supabase
    .from('post_comments')
    .select(`
      id,
      post_id,
      user_id,
      content,
      created_at,
      profiles!post_comments_user_id_fkey(full_name, username, avatar_url)
    `)
    .eq('post_id', postId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  return ((data as any[]) || []).map((c) => ({
    id: c.id,
    post_id: c.post_id,
    user_id: c.user_id,
    content: c.content,
    created_at: c.created_at,
    author_name: c.profiles?.full_name ?? 'Unknown',
    author_username: c.profiles?.username ?? 'unknown',
    author_avatar_url: c.profiles?.avatar_url ?? null,
  }));
}

export async function addComment(postId: string, content: string): Promise<void> {
  const { error } = await supabase.from('post_comments').insert({ post_id: postId, content });
  if (error) throw error;
}

export async function deleteComment(commentId: string): Promise<void> {
  const { error } = await supabase.from('post_comments').delete().eq('id', commentId);
  if (error) throw error;
}
