import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import type { Location } from '../types/database';

interface WorkingLocationState {
  /** The location the user is currently operating on. */
  location: Location | null;
  /** Every location the user may switch to (staff: just their own). */
  locations: Location[];
  loading: boolean;
  canSwitch: boolean;
  setLocationId: (id: string) => void;
}

const WorkingLocationContext = createContext<WorkingLocationState | null>(null);

const STORAGE_KEY = 'pp-working-location';

/**
 * Staff operate on their assigned location. Superadmin has no assigned
 * location, so they get a switcher over every active location, defaulting
 * to the production hub (Central). The choice persists per device.
 */
export function WorkingLocationProvider({ children }: { children: ReactNode }) {
  const { profile, location: own } = useAuth();
  const [all, setAll] = useState<Location[]>([]);
  const [loading, setLoading] = useState(!own);
  const [selectedId, setSelectedId] = useState<string | null>(
    () => localStorage.getItem(STORAGE_KEY),
  );

  useEffect(() => {
    if (own || !profile) return;
    supabase
      .from('locations')
      .select('*')
      .eq('active', true)
      .order('is_production', { ascending: false })
      .order('name')
      .then(({ data }) => {
        setAll(data ?? []);
        setLoading(false);
      });
  }, [own, profile]);

  const setLocationId = (id: string) => {
    localStorage.setItem(STORAGE_KEY, id);
    setSelectedId(id);
  };

  const value: WorkingLocationState = own
    ? { location: own, locations: [own], loading: false, canSwitch: false, setLocationId: () => {} }
    : {
        location: all.find((l) => l.id === selectedId) ?? all.find((l) => l.is_production) ?? all[0] ?? null,
        locations: all,
        loading,
        canSwitch: all.length > 1,
        setLocationId,
      };

  return (
    <WorkingLocationContext.Provider value={value}>{children}</WorkingLocationContext.Provider>
  );
}

export function useWorkingLocationContext(): WorkingLocationState {
  const ctx = useContext(WorkingLocationContext);
  if (!ctx) throw new Error('useWorkingLocationContext debe usarse dentro de WorkingLocationProvider');
  return ctx;
}
