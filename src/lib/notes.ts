import { supabase } from '@/lib/supabase';
import { Note, MyNote } from '@/types';

export async function createNote(content: string): Promise<void> {
  const { error } = await supabase.from('notes').insert({
    content,
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  });
  if (error) throw error;
}

export async function deleteNote(noteId: string): Promise<void> {
  const { error } = await supabase.from('notes').delete().eq('id', noteId);
  if (error) throw error;
}

export async function getActiveNotes(): Promise<Note[]> {
  const { data, error } = await supabase.rpc('get_active_notes');
  if (error) throw error;
  return (data || []) as Note[];
}

export async function getMyActiveNotes(): Promise<MyNote[]> {
  const { data, error } = await supabase.rpc('get_my_active_notes');
  if (error) throw error;
  return (data || []) as MyNote[];
}
