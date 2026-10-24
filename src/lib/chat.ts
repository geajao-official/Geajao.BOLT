import { supabase } from '@/lib/supabase';
import { Conversation, Message, ChatGroup, ChatGroupMessage, ChatGroupMember } from '@/types';

export async function getOrCreateConversation(friendId: string): Promise<string> {
  const { data, error } = await supabase.rpc('get_or_create_conversation', {
    p_friend_id: friendId,
  });
  if (error) throw error;
  return data as string;
}

export async function getConversations(): Promise<Conversation[]> {
  const { data, error } = await supabase.rpc('get_conversations');
  if (error) throw error;
  return (data || []) as Conversation[];
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  const { data, error } = await supabase.rpc('get_messages', {
    p_conversation_id: conversationId,
  });
  if (error) throw error;
  return (data || []) as Message[];
}

export async function markMessagesRead(conversationId: string) {
  const { error } = await supabase.rpc('mark_messages_read', {
    p_conversation_id: conversationId,
  });
  if (error) throw error;
}

export async function sendMessage(conversationId: string, content: string) {
  const { error } = await supabase.from('messages').insert({
    conversation_id: conversationId,
    content,
  });
  if (error) throw error;
}

export async function createGroup(name: string, memberIds: string[]): Promise<string> {
  const { data, error } = await supabase.rpc('create_chat_group', {
    p_name: name,
    p_member_ids: memberIds,
  });
  if (error) throw error;
  return data as string;
}

export async function getGroups(): Promise<ChatGroup[]> {
  const { data, error } = await supabase.rpc('get_chat_groups');
  if (error) throw error;
  return (data || []) as ChatGroup[];
}

export async function getGroupMembers(groupId: string): Promise<ChatGroupMember[]> {
  const { data, error } = await supabase.rpc('get_chat_group_members', {
    p_group_id: groupId,
  });
  if (error) throw error;
  return (data || []) as ChatGroupMember[];
}

export async function getGroupMessages(groupId: string): Promise<ChatGroupMessage[]> {
  const { data, error } = await supabase.rpc('get_chat_group_messages', {
    p_group_id: groupId,
  });
  if (error) throw error;
  return (data || []) as ChatGroupMessage[];
}

export async function sendGroupMessage(groupId: string, content: string) {
  const { error } = await supabase.rpc('send_chat_group_message', {
    p_group_id: groupId,
    p_content: content,
  });
  if (error) throw error;
}

export async function leaveGroup(groupId: string) {
  const { error } = await supabase.rpc('leave_chat_group', {
    p_group_id: groupId,
  });
  if (error) throw error;
}
