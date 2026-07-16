import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import type { Location } from '../types/database';

/**
 * The location the current user operates on. Staff use their own;
 * superadmin (no location) defaults to the production hub (Central).
 */
export function useWorkingLocation(): { location: Location | null; loading: boolean } {
  const { location: own, profile } = useAuth();
  const [fallback, setFallback] = useState<Location | null>(null);
  const [loading, setLoading] = useState(!own);

  useEffect(() => {
    if (own || !profile) return;
    supabase
      .from('locations')
      .select('*')
      .eq('is_production', true)
      .limit(1)
      .then(({ data }) => {
        setFallback(data?.[0] ?? null);
        setLoading(false);
      });
  }, [own, profile]);

  return { location: own ?? fallback, loading: own ? false : loading };
}
