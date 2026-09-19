import type { AuthError, Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

/** Row in `public.profiles`. email is private (owner-only RLS). */
export interface Profile {
  id: string;
  username: string;
  email: string;
  created_at: string;
}

export type UsernameStatus = "available" | "taken_account" | "taken_anonymous";

/** How the current session was established from the auth dialog. */
export type AuthKind = "signup" | "login";

export const USERNAME_MIN = 2;
export const USERNAME_MAX = 24;
export const PASSWORD_MIN = 8;

/** Turn a Supabase auth/database error into a sentence a player can act on. */
export function mapAuthError(error: unknown): string {
  const raw =
    typeof error === "string"
      ? error
      : ((error as { message?: string } | null)?.message ?? "Something went wrong. Try again.");
  const msg = raw.toLowerCase();
  if (msg.includes("already registered") || msg.includes("already been registered")) {
    return "An account with this email already exists. Log in instead.";
  }
  if (msg.includes("invalid login credentials")) return "Wrong email or password.";
  if (msg.includes("email not confirmed")) {
    return "Confirm your email first: check your inbox for the link, then log in.";
  }
  if (msg.includes("database error saving new user")) {
    return "That username was just taken. Try another.";
  }
  if (msg.includes("captcha")) return "Bot check failed. Please try again.";
  if (msg.includes("rate limit") || msg.includes("too many requests")) {
    return "Too many attempts. Wait a minute and try again.";
  }
  if (msg.includes("password should be at least")) {
    return `Password must be at least ${PASSWORD_MIN} characters.`;
  }
  if (msg.includes("failed to fetch") || msg.includes("network")) {
    return "Can't reach the server. Check your connection and try again.";
  }
  return raw;
}

/** Availability check via the `username_status` RPC (callable before an account exists). */
export async function checkUsername(name: string): Promise<UsernameStatus> {
  if (!supabase) return "available";
  const { data, error } = await supabase.rpc("username_status", { p_name: name.trim() });
  if (error) {
    console.error("username_status error:", error);
    // Fail open: the unique index on profiles still rejects a real collision at sign-up.
    return "available";
  }
  return (data as UsernameStatus) ?? "available";
}

export interface SignUpParams {
  email: string;
  password: string;
  username: string;
  captchaToken?: string;
}

export type SignUpResult =
  | { ok: true; user: User; session: Session | null }
  | { ok: false; message: string };

export async function signUp(params: SignUpParams): Promise<SignUpResult> {
  if (!supabase) return { ok: false, message: "Accounts are unavailable in this build." };
  const { data, error } = await supabase.auth.signUp({
    email: params.email.trim(),
    password: params.password,
    options: {
      data: { username: params.username.trim() },
      captchaToken: params.captchaToken,
    },
  });
  if (error) return { ok: false, message: mapAuthError(error) };
  const user = data.user;
  if (!user) return { ok: false, message: "Sign-up did not complete. Try again." };
  // With email confirmation ON, Supabase returns a placeholder user with no identities for an
  // email that already exists (to avoid leaking accounts). Surface that as "already registered".
  if (Array.isArray(user.identities) && user.identities.length === 0) {
    return { ok: false, message: mapAuthError("User already registered") };
  }
  return { ok: true, user, session: data.session };
}

export type SignInResult =
  | { ok: true; user: User; session: Session }
  | { ok: false; message: string };

export async function signIn(params: {
  email: string;
  password: string;
  captchaToken?: string;
}): Promise<SignInResult> {
  if (!supabase) return { ok: false, message: "Accounts are unavailable in this build." };
  const { data, error } = await supabase.auth.signInWithPassword({
    email: params.email.trim(),
    password: params.password,
    options: { captchaToken: params.captchaToken },
  });
  if (error) return { ok: false, message: mapAuthError(error) };
  if (!data.session || !data.user) return { ok: false, message: "Login did not complete. Try again." };
  return { ok: true, user: data.user, session: data.session };
}

export async function requestPasswordReset(
  email: string,
  captchaToken?: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!supabase) return { ok: false, message: "Accounts are unavailable in this build." };
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: window.location.origin,
    captchaToken,
  });
  if (error) return { ok: false, message: mapAuthError(error) };
  return { ok: true };
}

export async function updatePassword(
  password: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!supabase) return { ok: false, message: "Accounts are unavailable in this build." };
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { ok: false, message: mapAuthError(error) };
  return { ok: true };
}

export async function signOut(): Promise<AuthError | null> {
  if (!supabase) return null;
  const { error } = await supabase.auth.signOut();
  return error;
}

/** The signed-in player's own profile (RLS limits the query to their row). */
export async function fetchOwnProfile(userId: string): Promise<Profile | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, email, created_at")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    console.error("profile fetch error:", error);
    return null;
  }
  return (data as Profile | null) ?? null;
}

/** Attach this device's pre-account leaderboard rows to the signed-in account. */
export async function claimSolves(rowIds: string[]): Promise<number> {
  if (!supabase || rowIds.length === 0) return 0;
  const { data, error } = await supabase.rpc("claim_solves", { p_ids: rowIds });
  if (error) {
    console.error("claim_solves error:", error);
    return 0;
  }
  return typeof data === "number" ? data : 0;
}

// ---------------------------------------------------------------------------
// Client-side validation shared by the auth dialog.
// ---------------------------------------------------------------------------

export function validateEmail(email: string): string | null {
  const t = email.trim();
  if (!t) return "Enter your email.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return "Enter a valid email address.";
  return null;
}

export function validateUsername(username: string): string | null {
  const t = username.trim();
  if (!t) return "Choose a username.";
  if (t.length < USERNAME_MIN) return `Username must be at least ${USERNAME_MIN} characters.`;
  if (t.length > USERNAME_MAX) return `Username must be ${USERNAME_MAX} characters or fewer.`;
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) return "Enter a password.";
  if (password.length < PASSWORD_MIN) return `Password must be at least ${PASSWORD_MIN} characters.`;
  return null;
}

