import { supabase } from '@/lib/supabase';
import { Profile } from '@/types';

const KEY = 'geajao-remembered-account';

export interface RememberedAccount {
  username: string;
  full_name: string;
  avatar_url: string | null;
}

export function getRememberedAccount(): RememberedAccount | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RememberedAccount;
    if (!parsed.username) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function refreshRememberedAccount(userId: string) {
  try {
    const { data } = await supabase
      .from('profiles')
      .select('username, full_name, avatar_url')
      .eq('id', userId)
      .maybeSingle();
    if (data) {
      const acct: RememberedAccount = {
        username: (data as Profile).username,
        full_name: (data as Profile).full_name,
        avatar_url: (data as Profile).avatar_url ?? null,
      };
      localStorage.setItem(KEY, JSON.stringify(acct));
    }
  } catch {
    // ignore
  }
}

export function clearRememberedAccount() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
