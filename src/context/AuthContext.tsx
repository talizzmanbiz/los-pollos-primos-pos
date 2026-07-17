import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Location, Profile } from '../types/database';

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  location: Location | null; // null for superadmin (cross-location)
  loading: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [location, setLocation] = useState<Location | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (!data.session) setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (!s) {
        setProfile(null);
        setLocation(null);
        setLoading(false);
      }
    });
    // If the refresh token dies (revoked, expired, used twice), supabase-js
    // can fail silently and fall back to anon — the UI looks logged in but
    // every write gets rejected. Re-validate whenever the tab regains focus
    // so the user lands on /login instead of hitting cryptic RLS errors.
    const revalidate = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) setSession(null);
    };
    window.addEventListener('focus', revalidate);
    return () => {
      sub.subscription.unsubscribe();
      window.removeEventListener('focus', revalidate);
    };
  }, []);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      const { data: p } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
      if (cancelled) return;
      setProfile(p ?? null);
      if (p?.location_id) {
        const { data: loc } = await supabase
          .from('locations')
          .select('*')
          .eq('id', p.location_id)
          .single();
        if (!cancelled) setLocation(loc ?? null);
      } else {
        setLocation(null);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [session]);

  async function signIn(email: string, password: string): Promise<string | null> {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? error.message : null;
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ session, profile, location, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
