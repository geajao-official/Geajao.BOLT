import { supabase } from '@/lib/supabase';
import { FriendRequest, SentRequest, Friend, DiscoverUser, PublicProfile } from '@/types';

export async function sendFriendRequest(addresseeId: string) {
  const { error } = await supabase.rpc('send_friend_request', {
    p_addressee_id: addresseeId,
  });
  if (error) throw error;
}

export async function acceptFriendRequest(requesterId: string) {
  const { error } = await supabase.rpc('accept_friend_request', {
    p_requester_id: requesterId,
  });
  if (error) throw error;
}

export async function declineFriendRequest(requesterId: string) {
  const { error } = await supabase.rpc('decline_friend_request', {
    p_requester_id: requesterId,
  });
  if (error) throw error;
}

export async function removeFriend(friendId: string) {
  const { error } = await supabase.rpc('remove_friend', {
    p_friend_id: friendId,
  });
  if (error) throw error;
}

export async function getFriendRequests(): Promise<FriendRequest[]> {
  const { data, error } = await supabase.rpc('get_friend_requests');
  if (error) throw error;
  return (data || []) as FriendRequest[];
}

export async function getSentRequests(): Promise<SentRequest[]> {
  const { data, error } = await supabase.rpc('get_sent_requests');
  if (error) throw error;
  return (data || []) as SentRequest[];
}

export async function getFriends(): Promise<Friend[]> {
  const { data, error } = await supabase.rpc('get_friends');
  if (error) throw error;
  return (data || []) as Friend[];
}

export async function getFriendshipStatus(otherUserId: string): Promise<string> {
  const { data, error } = await supabase.rpc('get_friendship_status', {
    p_other_user_id: otherUserId,
  });
  if (error) throw error;
  return (data || 'none') as string;
}

export async function deleteOwnAccount() {
  const { error } = await supabase.rpc('delete_own_account');
  if (error) throw error;
}

export async function getDiscoverUsers(): Promise<DiscoverUser[]> {
  const { data, error } = await supabase.rpc('get_discover_users');
  if (error) throw error;
  return (data || []) as DiscoverUser[];
}

export async function getPublicProfile(userId: string): Promise<PublicProfile | null> {
  const { data, error } = await supabase.rpc('get_public_profile', {
    p_user_id: userId,
  });
  if (error) throw error;
  return ((data as unknown as PublicProfile[]) || [])[0] ?? null;
}

export async function getUserFriends(userId: string): Promise<Friend[]> {
  const { data, error } = await supabase.rpc('get_user_friends', {
    p_user_id: userId,
  });
  if (error) throw error;
  return (data || []) as Friend[];
}
