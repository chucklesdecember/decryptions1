import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { User } from "@supabase/supabase-js";
import posthog from "posthog-js";
import { toast } from "sonner";
import { supabase } from "./supabase";
import {
  fetchOwnProfile,
  signOut as apiSignOut,
  type AuthKind,
  type Profile,
} from "./authApi";
import { ensureLeaderboardPosted, syncAfterSignIn, upsertProgress } from "./progressSync";
import {
  clearLocalProgress,
  getStoredLeaderboardRowId,
  getStoredUsername,
  markAccountUsedOnDevice,
  markPuzzleSolvedLocally,
} from "./decryptionsStorage";
import { AuthDialog } from "../components/AuthDialog";
import { ResetPasswordDialog } from "../components/ResetPasswordDialog";
import { Toaster } from "../components/ui/sonner";

export type { AuthKind } from "./authApi";

/**
 * `unavailable`: Supabase env vars are missing (local dev without .env). The app then plays
 * without accounts, mirroring the existing "Leaderboard is unavailable" behaviour.
 */
export type AuthStatus = "loading" | "signed_out" | "signed_in" | "unavailable";

export interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  profile: Profile | null;
  /** True while the post-login progress sync is running. */
  syncing: boolean;
  /** Increments whenever synced progress changed localStorage; depend on it to re-render. */
  progressVersion: number;
  bumpProgress: () => void;
  /**
   * Open the log in / sign up dialog. `onSuccess` fires only after the session exists AND
   * the progress sync has finished, so callers can read localStorage safely.
   * When accounts are unavailable the callback runs immediately with kind "login".
   */
  requireAuth: (onSuccess?: (kind: AuthKind) => void) => void;
  signOut: () => Promise<void>;
  /**
   * Save a solve locally, then (signed in) in the `progress` table and on the leaderboard.
   * Resolves with the leaderboard row id when the time is on the board.
   */
  recordSolve: (
    puzzleId: string,
    timeSeconds: number,
    hintsUsed: number,
  ) => Promise<{ rowId: string | null }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(supabase ? "loading" : "unavailable");
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [progressVersion, setProgressVersion] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  const userRef = useRef<User | null>(null);
  const profileRef = useRef<Profile | null>(null);
  useEffect(() => {
    userRef.current = user;
  }, [user]);
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  /** Callback handed to `requireAuth`, fired once login + sync complete. */
  const pendingSuccessRef = useRef<((kind: AuthKind) => void) | null>(null);
  /** Set by the dialog right before an attempt so the sync knows a brand-new account is involved. */
  const pendingKindRef = useRef<AuthKind | null>(null);
  /** One sync per user id per session; the dialog and the auth listener share the same promise. */
  const syncPromisesRef = useRef<Map<string, Promise<Profile | null>>>(new Map());
  /** Per-puzzle lock so a double `onComplete` cannot post twice. */
  const inflightSolvesRef = useRef<Set<string>>(new Set());

  const bumpProgress = useCallback(() => setProgressVersion((v) => v + 1), []);

  const runPostLoginSync = useCallback(
    (u: User, kind: AuthKind | "session"): Promise<Profile | null> => {
      const existing = syncPromisesRef.current.get(u.id);
      if (existing) return existing;

      const job = (async () => {
        setSyncing(true);
        // The profile row is created by a DB trigger right after sign-up; allow it a moment.
        let p = await fetchOwnProfile(u.id);
        for (let attempt = 0; !p && attempt < 4; attempt++) {
          await sleep(500);
          p = await fetchOwnProfile(u.id);
        }
        setProfile(p);
        markAccountUsedOnDevice();

        if (p) {
          const legacyName = getStoredUsername()?.toLowerCase();
          const allowClaimLegacyRows =
            kind === "signup" || (!!legacyName && legacyName === p.username.toLowerCase());
          try {
            const summary = await syncAfterSignIn({
              userId: u.id,
              username: p.username,
              allowClaimLegacyRows,
            });
            posthog.capture("progress_synced", { ...summary, kind });
          } catch (err) {
            console.error("Progress sync failed:", err);
            toast.error("Couldn't sync your progress. It will retry next time you open the game.");
          }
        } else {
          console.error("No profile row found for user", u.id);
          toast.error("Your account is missing its profile. Contact support if this persists.");
        }

        setProgressVersion((v) => v + 1);
        setSyncing(false);
        return p;
      })();

      syncPromisesRef.current.set(u.id, job);
      return job;
    },
    [],
  );

  // Session bootstrap + auth events.
  useEffect(() => {
    if (!supabase) return;
    const client = supabase;

    void client.auth.getSession().then(({ data }) => {
      const u = data.session?.user ?? null;
      setUser(u);
      setStatus(u ? "signed_in" : "signed_out");
    });

    const { data: sub } = client.auth.onAuthStateChange((event, session) => {
      // Do not await Supabase calls in here (documented deadlock); only update state.
      const u = session?.user ?? null;
      setUser(u);
      setStatus(u ? "signed_in" : "signed_out");
      if (event === "PASSWORD_RECOVERY") setResetOpen(true);
      if (event === "SIGNED_OUT") {
        setProfile(null);
        syncPromisesRef.current.clear();
      }
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  // Whenever a session appears (page load, login, sign-up), sync once for that user.
  useEffect(() => {
    if (!user) return;
    void runPostLoginSync(user, pendingKindRef.current ?? "session");
  }, [user?.id, runPostLoginSync]);

  const requireAuth = useCallback(
    (onSuccess?: (kind: AuthKind) => void) => {
      if (!supabase) {
        onSuccess?.("login");
        return;
      }
      if (userRef.current) {
        onSuccess?.("login");
        return;
      }
      pendingSuccessRef.current = onSuccess ?? null;
      setDialogOpen(true);
    },
    [],
  );

  const handleDialogOpenChange = useCallback((open: boolean) => {
    setDialogOpen(open);
    if (!open) pendingSuccessRef.current = null;
  }, []);

  const handleAttemptStart = useCallback((kind: AuthKind) => {
    pendingKindRef.current = kind;
  }, []);

  /** Called by the dialog after Supabase accepted the credentials. Resolves when sync is done. */
  const handleAuthenticated = useCallback(
    async (kind: AuthKind, u: User) => {
      setUser(u);
      setStatus("signed_in");
      await runPostLoginSync(u, kind);
      pendingKindRef.current = null;
      setDialogOpen(false);
      posthog.capture(kind === "signup" ? "signup_completed" : "login_completed");
      const cb = pendingSuccessRef.current;
      pendingSuccessRef.current = null;
      cb?.(kind);
    },
    [runPostLoginSync],
  );

  const signOut = useCallback(async () => {
    const err = await apiSignOut();
    if (err) console.error("Sign-out error:", err);
    // The account's data lives in `progress`; wipe the device cache so another account starts clean.
    clearLocalProgress();
    syncPromisesRef.current.clear();
    setProfile(null);
    setUser(null);
    setStatus(supabase ? "signed_out" : "unavailable");
    setProgressVersion((v) => v + 1);
    posthog.capture("signed_out");
  }, []);

  const recordSolve = useCallback(
    async (puzzleId: string, timeSeconds: number, hintsUsed: number) => {
      markPuzzleSolvedLocally(puzzleId, timeSeconds, hintsUsed);
      setProgressVersion((v) => v + 1);

      const u = userRef.current;
      if (!supabase || !u) return { rowId: null };
      if (inflightSolvesRef.current.has(puzzleId)) {
        return { rowId: getStoredLeaderboardRowId(puzzleId) };
      }
      inflightSolvesRef.current.add(puzzleId);
      try {
        await upsertProgress({ userId: u.id, puzzleId, timeSeconds, hintsUsed });
        const { rowId, posted } = await ensureLeaderboardPosted({
          userId: u.id,
          username: profileRef.current?.username ?? "",
          puzzleId,
          timeSeconds,
          hintsUsed,
        });
        if (posted) {
          posthog.capture("leaderboard_auto_submitted", { puzzle_id: puzzleId });
        } else if (!rowId) {
          toast.error("Couldn't post your time to the leaderboard. You can retry from the leaderboard.");
        }
        return { rowId };
      } finally {
        inflightSolvesRef.current.delete(puzzleId);
        setProgressVersion((v) => v + 1);
      }
    },
    [],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      profile,
      syncing,
      progressVersion,
      bumpProgress,
      requireAuth,
      signOut,
      recordSolve,
    }),
    [status, user, profile, syncing, progressVersion, bumpProgress, requireAuth, signOut, recordSolve],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      {supabase && (
        <>
          <AuthDialog
            open={dialogOpen}
            onOpenChange={handleDialogOpenChange}
            onAttemptStart={handleAttemptStart}
            onAuthenticated={handleAuthenticated}
          />
          <ResetPasswordDialog open={resetOpen} onOpenChange={setResetOpen} />
        </>
      )}
      <Toaster richColors position="top-center" />
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
