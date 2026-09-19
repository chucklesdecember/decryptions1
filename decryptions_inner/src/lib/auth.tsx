import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { supabase } from './supabase';
import { fetchOwnProfile, signOut as apiSignOut, type AuthKind, type Profile } from './authApi';
import { cacheProgress, syncAfterSignIn } from './progressSync';
import type { ProgressRow } from './gameApi';
import { clearLocalProgress, markAccountUsedOnDevice } from './decryptionsStorage';
import { AuthDialog } from '../components/AuthDialog';
import { ResetPasswordDialog } from '../components/ResetPasswordDialog';
import { Toaster } from '../components/ui/sonner';

export type AuthStatus = 'loading' | 'signed_out' | 'signed_in' | 'unavailable';
interface AuthContextValue {
  status: AuthStatus; user: User | null; profile: Profile | null; syncing: boolean;
  progress: ProgressRow[];
  refreshProgress: () => Promise<void>;
  requireAuth: (onSuccess?: (kind: AuthKind, userId: string) => void) => void;
  signOut: () => Promise<void>;
}
const AuthContext = createContext<AuthContextValue | null>(null);
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(supabase ? 'loading' : 'unavailable');
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [progress, setProgress] = useState<ProgressRow[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const userRef = useRef<User | null>(null);
  const epoch = useRef(0);
  const syncJob = useRef<Promise<boolean> | null>(null);
  const pendingSuccess = useRef<((kind: AuthKind, userId: string) => void) | null>(null);

  const acceptUser = useCallback((u: User | null) => {
    if (u?.id !== userRef.current?.id) {
      epoch.current++; syncJob.current = null;
      setProfile(null); setProgress([]); setSyncing(false); clearLocalProgress();
    }
    userRef.current = u; setUser(u); setStatus(u ? 'signed_in' : 'signed_out');
  }, []);
  const sync = useCallback((): Promise<boolean> => {
    if (syncJob.current) return syncJob.current;
    const u = userRef.current;
    if (!u) return Promise.resolve(false);
    const generation = epoch.current;
    setSyncing(true);
    const job = (async () => {
      try {
        const [p, rows] = await Promise.all([fetchOwnProfile(u.id), syncAfterSignIn()]);
        if (generation !== epoch.current) return false;
        if (!p) throw new Error('Your account profile is unavailable. Please try signing in again.');
        setProfile(p); setProgress(rows); cacheProgress(u.id, rows); markAccountUsedOnDevice();
        return true;
      } catch (err) {
        if (generation === epoch.current) toast.error(err instanceof Error ? err.message : 'Could not load account progress. Please retry.');
        return false;
      } finally {
        if (generation === epoch.current) { setSyncing(false); syncJob.current = null; }
      }
    })();
    syncJob.current = job;
    return job;
  }, []);
  const refreshProgress = useCallback(async () => {
    // A solve may finish during a prior read; refresh again after that read settles.
    if (syncJob.current) await syncJob.current;
    await sync();
  }, [sync]);
  useEffect(() => {
    if (!supabase) return;
    let active = true, authEventSeen = false;
    void supabase.auth.getSession().then(({ data, error }) => {
      if (active && !authEventSeen) acceptUser(error ? null : data.session?.user ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      authEventSeen = true;
      if (!active) return;
      // Never await Supabase requests inside the auth listener.
      acceptUser(session?.user ?? null);
      if (event === 'PASSWORD_RECOVERY') setResetOpen(true);
    });
    return () => { active = false; epoch.current++; sub.subscription.unsubscribe(); };
  }, [acceptUser]);
  useEffect(() => { if (user) void sync(); }, [user?.id, sync]);
  const requireAuth = useCallback((onSuccess?: (kind: AuthKind, userId: string) => void) => {
    if (!supabase) { toast.error('The game is currently unavailable. Please try again later.'); return; }
    if (userRef.current) {
      const id = userRef.current.id;
      void sync().then(ok => { if (ok && userRef.current?.id === id) onSuccess?.('login', id); });
    } else { pendingSuccess.current = onSuccess ?? null; setDialogOpen(true); }
  }, [sync]);
  const handleAuthenticated = useCallback(async (kind: AuthKind, u: User) => {
    acceptUser(u);
    if (!(await sync()) || userRef.current?.id !== u.id) return;
    setDialogOpen(false);
    const cb = pendingSuccess.current; pendingSuccess.current = null; cb?.(kind, u.id);
  }, [acceptUser, sync]);
  const signOut = useCallback(async () => {
    const error = await apiSignOut();
    if (error) { toast.error('Could not sign out. Check your connection and retry.'); return; }
    pendingSuccess.current = null; acceptUser(null); clearLocalProgress();
  }, [acceptUser]);
  const value = useMemo(() => ({ status, user, profile, progress, syncing, refreshProgress, requireAuth, signOut }),
    [status, user, profile, progress, syncing, refreshProgress, requireAuth, signOut]);
  return <AuthContext.Provider value={value}>
    {children}
    {supabase && <>
      <AuthDialog open={dialogOpen} onOpenChange={open => { setDialogOpen(open); if (!open) pendingSuccess.current = null; }}
        onAttemptStart={() => {}} onAuthenticated={handleAuthenticated} />
      <ResetPasswordDialog open={resetOpen} onOpenChange={setResetOpen} />
    </>}
    <Toaster richColors position="top-center" />
  </AuthContext.Provider>;
}
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
