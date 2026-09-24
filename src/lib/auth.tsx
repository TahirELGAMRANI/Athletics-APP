import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { supabase } from './supabase';
import type { Player, Profile } from './types';

type AuthState = {
  loading: boolean;
  session: Session | null;
  profile: Profile | null;
  /** Roster entries linked to this account (players only). */
  myPlayers: Player[];
  /** Team ids this account coaches. */
  coachedTeamIds: string[];
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [myPlayers, setMyPlayers] = useState<Player[]>([]);
  const [coachedTeamIds, setCoached] = useState<string[]>([]);

  const load = useCallback(async (s: Session | null) => {
    setSession(s);
    if (!s) {
      setProfile(null);
      setMyPlayers([]);
      setCoached([]);
      setLoading(false);
      return;
    }
    const uid = s.user.id;
    const [p, pl, tc] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', uid).single(),
      supabase.from('players').select('*').eq('profile_id', uid),
      supabase.from('team_coaches').select('team_id').eq('profile_id', uid),
    ]);
    setProfile((p.data as Profile) ?? null);
    setMyPlayers((pl.data as Player[]) ?? []);
    setCoached(((tc.data as { team_id: string }[]) ?? []).map((r) => r.team_id));
    setLoading(false);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => load(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'TOKEN_REFRESHED') {
        setSession(s);
        return;
      }
      // Defer to avoid calling Supabase inside the auth callback lock.
      setTimeout(() => load(s), 0);
    });
    return () => sub.subscription.unsubscribe();
  }, [load]);

  const value: AuthState = {
    loading,
    session,
    profile,
    myPlayers,
    coachedTeamIds,
    refresh: async () => {
      const { data } = await supabase.auth.getSession();
      await load(data.session);
    },
    signOut: async () => {
      await supabase.auth.signOut();
    },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

export function usePermissions() {
  const { profile, coachedTeamIds, myPlayers } = useAuth();
  const role = profile?.role;
  const isSuper = role === 'super_admin';
  return {
    role,
    isSuper,
    isAdmin: role === 'admin',
    isCoach: role === 'coach',
    isPlayer: role === 'player',
    isStudent: role === 'student',
    canManageTeam: (teamId: string) => isSuper || coachedTeamIds.includes(teamId),
    canSeePortfolio: (player: { id: string; team_id: string }) =>
      isSuper || coachedTeamIds.includes(player.team_id) || myPlayers.some((p) => p.id === player.id),
  };
}
