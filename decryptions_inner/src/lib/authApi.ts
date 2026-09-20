import type { AuthError, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

/** Row in `public.profiles`. Contact details are private (owner-only RLS). */
export interface Profile {
  id: string;
  username: string;
  email: string;
  created_at: string;
}

export type UsernameStatus = "available" | "taken_account" | "taken_anonymous";
export type AuthKind = "signup" | "login";

export const USERNAME_MIN = 2;
export const USERNAME_MAX = 24;

export function mapAuthError(error: unknown): string {
  const raw =
    typeof error === "string"
      ? error
      : ((error as { message?: string } | null)?.message ?? "Something went wrong. Try again.");
  const message = raw.toLowerCase();
  if (
    message.includes("already registered") ||
    message.includes("already been registered") ||
    message.includes("email address has already") ||
    message.includes("email exists")
  ) {
    return "An account with this email already exists. Log in instead.";
  }
  if (message.includes("database error saving new user")) {
    return "That username was just taken. Try another.";
  }
  if (message.includes("anonymous sign-ins are disabled")) {
    return "Account creation is not enabled yet. Please try again later.";
  }
  if (message.includes("captcha")) return "Bot check failed. Please try again.";
  if (message.includes("rate limit") || message.includes("too many requests")) {
    return "Too many attempts. Wait a minute and try again.";
  }
  if (
    message.includes("failed to fetch") ||
    message.includes("network") ||
    message.includes("reach") ||
    message.includes("connect")
  ) {
    return "The account service is currently unavailable. Please try again later.";
  }
  return raw;
}

export async function checkUsername(name: string): Promise<UsernameStatus> {
  if (!supabase) return "available";
  const { data, error } = await supabase.rpc("username_status", { p_name: name.trim() });
  if (error) {
    console.error("username_status error:", error);
    return "available";
  }
  return (data as UsernameStatus) ?? "available";
}

interface PasswordlessParams {
  email: string;
  captchaToken?: string;
}

export async function sendLoginLink(
  params: PasswordlessParams,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!supabase) return { ok: false, message: "Accounts are unavailable in this build." };
  const { error } = await supabase.auth.signInWithOtp({
    email: params.email.trim(),
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${window.location.origin}/`,
      captchaToken: params.captchaToken,
    },
  });
  if (error) return { ok: false, message: mapAuthError(error) };
  return { ok: true };
}

export async function createPasswordlessAccount(params: PasswordlessParams & {
  username: string;
}): Promise<{ ok: true; user: User } | { ok: false; message: string }> {
  if (!supabase) return { ok: false, message: "Accounts are unavailable in this build." };

  const { data: anonymous, error: anonymousError } = await supabase.auth.signInAnonymously({
    options: {
      data: { username: params.username.trim() },
      captchaToken: params.captchaToken,
    },
  });
  if (anonymousError) return { ok: false, message: mapAuthError(anonymousError) };
  if (!anonymous.user || !anonymous.session) {
    return { ok: false, message: "Account creation did not complete. Try again." };
  }

  const { data: linked, error: linkError } = await supabase.auth.updateUser(
    {
      email: params.email.trim(),
      data: { username: params.username.trim() },
    },
    { emailRedirectTo: `${window.location.origin}/` },
  );
  if (linkError) {
    await supabase.auth.signOut();
    return { ok: false, message: mapAuthError(linkError) };
  }

  return { ok: true, user: linked.user ?? anonymous.user };
}

export async function signOut(): Promise<AuthError | null> {
  if (!supabase) return null;
  const { error } = await supabase.auth.signOut();
  return error;
}

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

export function validateEmail(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) return "Enter your email.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return "Enter a valid email address.";
  return null;
}

export function validateUsername(username: string): string | null {
  const trimmed = username.trim();
  if (!trimmed) return "Choose a username.";
  if (trimmed.length < USERNAME_MIN) return `Username must be at least ${USERNAME_MIN} characters.`;
  if (trimmed.length > USERNAME_MAX) return `Username must be ${USERNAME_MAX} characters or fewer.`;
  return null;
}
