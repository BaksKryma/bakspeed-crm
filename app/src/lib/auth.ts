import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

interface ManagerProfile {
  id: string;
  code: string;
  full_name: string;
  role: 'owner' | 'manager' | 'accountant' | 'viewer';
}

interface AuthState {
  session: Session | null;
  profile: ManagerProfile | null;
  ready: boolean;
  setSession: (s: Session | null) => void;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export const useAuth = create<AuthState>((set, get) => ({
  session: null,
  profile: null,
  ready: false,
  setSession: (session) => {
    set({ session });
    if (session) void get().refreshProfile();
    else set({ profile: null });
  },
  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, profile: null });
  },
  refreshProfile: async () => {
    const uid = get().session?.user?.id;
    if (!uid) return;
    const { data } = await supabase
      .from('managers')
      .select('id, code, full_name, role')
      .eq('user_id', uid)
      .maybeSingle();
    set({ profile: data as ManagerProfile | null });
  },
}));

void supabase.auth.getSession().then(({ data }) => {
  useAuth.setState({ session: data.session, ready: true });
  if (data.session) void useAuth.getState().refreshProfile();
});

supabase.auth.onAuthStateChange((_event, session) => {
  useAuth.getState().setSession(session);
});
