import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { supabase } from './supabase';
import { ensureOwnProfile, fetchOwnProfile, signOut as apiSignOut, type AuthKind, type Profile } from './authApi';
import { cacheProgress, syncAfterSignIn } from './progressSync';
import type { ProgressRow } from './gameApi';
import { clearLocalProgress, markAccountUsedOnDevice } from './decryptionsStorage';
import { AuthDialog } from '../components/AuthDialog';
import { GuestDialog } from '../components/GuestDialog';
import { Toaster } from '../components/ui/sonner';

export type AuthStatus = 'loading' | 'signed_out' | 'signed_in' | 'unavailable';
interface AuthContextValue {
  status: AuthStatus; user: User | null; profile: Profile | null; syncing: boolean;
  isGuest: boolean;
  progress: ProgressRow[];
  refreshProgress: () => Promise<void>;
  requirePlayer: (onSuccess?: (kind: AuthKind, userId: string) => void) => void;
  requireAccount: (onSuccess?: (kind: AuthKind, userId: string) => void) => void;
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
  const [guestDialogOpen, setGuestDialogOpen] = useState(false);
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
        let p = await fetchOwnProfile(u.id);
        if (!p && await ensureOwnProfile()) p = await fetchOwnProfile(u.id);
        const rows = await syncAfterSignIn();
        if (generation !== epoch.current) return false;
        if (!p) throw new Error('Your account profile is unavailable. Please try signing in again.');
        setProfile(p); setProgress(rows); cacheProgress(u.id, rows);
        if (!u.is_anonymous) markAccountUsedOnDevice();
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
    });
    return () => { active = false; epoch.current++; sub.subscription.unsubscribe(); };
  }, [acceptUser]);
  useEffect(() => { if (user) void sync(); }, [user?.id, user?.is_anonymous, sync]);
  const requirePlayer = useCallback((onSuccess?: (kind: AuthKind, userId: string) => void) => {
    if (!supabase) { toast.error('The game is currently unavailable. Please try again later.'); return; }
    if (userRef.current) {
      const id = userRef.current.id;
      void sync().then(ok => { if (ok && userRef.current?.id === id) onSuccess?.('login', id); });
    } else { pendingSuccess.current = onSuccess ?? null; setGuestDialogOpen(true); }
  }, [sync]);
  const requireAccount = useCallback((onSuccess?: (kind: AuthKind, userId: string) => void) => {
    if (!supabase) { toast.error('Accounts are currently unavailable. Please try again later.'); return; }
    if (userRef.current && !userRef.current.is_anonymous) {
      const id = userRef.current.id;
      void sync().then(ok => { if (ok && userRef.current?.id === id) onSuccess?.('login', id); });
      return;
    }
    pendingSuccess.current = onSuccess ?? null;
    setDialogOpen(true);
  }, [sync]);
  const handleAuthenticated = useCallback(async (kind: AuthKind, u: User) => {
    acceptUser(u);
    if (!(await sync()) || userRef.current?.id !== u.id) return;
    setDialogOpen(false);
    if (kind === 'signup') {
      toast.success('Account created. You can play now.');
    }
    const cb = pendingSuccess.current; pendingSuccess.current = null; cb?.(kind, u.id);
  }, [acceptUser, sync]);
  const handleGuestStarted = useCallback(async (u: User) => {
    acceptUser(u);
    if (!(await sync()) || userRef.current?.id !== u.id) return;
    setGuestDialogOpen(false);
    const cb = pendingSuccess.current; pendingSuccess.current = null; cb?.('guest', u.id);
  }, [acceptUser, sync]);
  const signOut = useCallback(async () => {
    const error = await apiSignOut();
    if (error) { toast.error('Could not sign out. Check your connection and retry.'); return; }
    pendingSuccess.current = null; acceptUser(null); clearLocalProgress();
  }, [acceptUser]);
  const isGuest = !!user?.is_anonymous;
  const value = useMemo(() => ({ status, user, profile, isGuest, progress, syncing, refreshProgress, requirePlayer, requireAccount, signOut }),
    [status, user, profile, isGuest, progress, syncing, refreshProgress, requirePlayer, requireAccount, signOut]);
  return <AuthContext.Provider value={value}>
    {children}
    {supabase && <>
      <AuthDialog open={dialogOpen} onOpenChange={open => { setDialogOpen(open); if (!open) pendingSuccess.current = null; }}
        onAuthenticated={handleAuthenticated} initialUsername={profile?.username} />
      <GuestDialog open={guestDialogOpen}
        onOpenChange={open => { setGuestDialogOpen(open); if (!open) pendingSuccess.current = null; }}
        onStarted={handleGuestStarted} />
    </>}
    <Toaster richColors position="top-center" />
  </AuthContext.Provider>;
}
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
