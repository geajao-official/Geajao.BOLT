import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

const cache: Record<'site' | 'team', string | null | undefined> = {
  site: undefined,
  team: undefined,
};

export function invalidateLogoCache() {
  cache.site = undefined;
  cache.team = undefined;
}

function useLogoSetting(fnName: 'get_site_logo' | 'get_team_logo'): string | null {
  const [url, setUrl] = useState<string | null>(cache[fnName === 'get_site_logo' ? 'site' : 'team'] ?? null);

  const fetchLogo = useCallback(async () => {
    const { data, error } = await supabase.rpc(fnName);
    if (!error) {
      const value = (data as string | null) ?? null;
      cache[fnName === 'get_site_logo' ? 'site' : 'team'] = value;
      setUrl(value);
    }
  }, [fnName]);

  useEffect(() => {
    if (cache[fnName === 'get_site_logo' ? 'site' : 'team'] === undefined) {
      fetchLogo();
    }
  }, [fnName, fetchLogo]);

  return url;
}

export function useSiteLogo(): string | null {
  return useLogoSetting('get_site_logo');
}

export function useTeamLogo(): string | null {
  return useLogoSetting('get_team_logo');
}
