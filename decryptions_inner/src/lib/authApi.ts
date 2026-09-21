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
export type AuthKind = "signup" | "login" | "guest";

export const USERNAME_MIN = 2;
export const USERNAME_MAX = 24;
export const EMAIL_USERNAME_MAX = 64;

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
  if (message.includes("database error saving new user") || message.includes("profiles_username_lower_key")) {
    return "That email's username prefix is already in use. Use a different email address.";
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

interface EmailCodeParams {
  email: string;
  captchaToken?: string;
}

const PRODUCTION_AUTH_REDIRECT = "https://decryptions1.vercel.app/";

export function authRedirectUrl(): string {
  const configured = (import.meta.env.VITE_AUTH_REDIRECT_URL as string | undefined)?.trim();
  return configured || PRODUCTION_AUTH_REDIRECT;
}

export async function sendEmailCode(params: EmailCodeParams & {
  username: string;
  upgradingGuest?: boolean;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!supabase) return { ok: false, message: "Accounts are unavailable in this build." };
  const email = params.email.trim();
  const current = (await supabase.auth.getUser()).data.user;
  if (current?.is_anonymous && params.upgradingGuest) {
    const { error } = await supabase.auth.updateUser({ email, data: { username: params.username } });
    if (error) return { ok: false, message: mapAuthError(error) };
  }
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: !(current?.is_anonymous && params.upgradingGuest),
      data: { username: params.username },
      captchaToken: params.captchaToken,
    },
  });
  if (error) return { ok: false, message: mapAuthError(error) };
  return { ok: true };
}

export async function sendLegacyUsernameCode(params: {
  username: string;
  captchaToken?: string;
}): Promise<{ ok: true; email: string } | { ok: false; message: string }> {
  if (!supabase) return { ok: false, message: "Accounts are unavailable in this build." };
  const { data: email, error: lookupError } = await supabase.rpc("login_email_for_identifier", { p_identifier: params.username.trim() });
  if (lookupError) return { ok: false, message: mapAuthError(lookupError) };
  if (!email) return { ok: false, message: "We could not find an email for that username." };
  const { error } = await supabase.auth.signInWithOtp({
    email: email as string,
    options: { shouldCreateUser: false, captchaToken: params.captchaToken },
  });
  if (error) return { ok: false, message: mapAuthError(error) };
  return { ok: true, email: email as string };
}

export async function verifyEmailCode(params: { email: string; code: string }): Promise<{ ok: true; user: User } | { ok: false; message: string }> {
  if (!supabase) return { ok: false, message: "Accounts are unavailable in this build." };
  const { data, error } = await supabase.auth.verifyOtp({ email: params.email.trim(), token: params.code.trim(), type: "email" });
  if (error) return { ok: false, message: mapAuthError(error) };
  if (!data.user || !data.session) return { ok: false, message: "That code could not be verified. Try again." };
  return { ok: true, user: data.user };
}

export async function createGuest(params: {
  username: string;
  captchaToken?: string;
}): Promise<{ ok: true; user: User } | { ok: false; message: string }> {
  if (!supabase) return { ok: false, message: "Guest play is unavailable in this build." };
  const { data, error } = await supabase.auth.signInAnonymously({
    options: {
      data: { username: params.username.trim() },
      captchaToken: params.captchaToken,
    },
  });
  if (error) return { ok: false, message: mapAuthError(error) };
  if (!data.user || !data.session) {
    return { ok: false, message: "Guest play did not start. Try again." };
  }
  return { ok: true, user: data.user };
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

/** Account leaderboard names are intentionally derived, never entered manually. */
export function usernameFromEmail(email: string): string | null {
  const trimmed = email.trim();
  const at = trimmed.indexOf("@");
  if (at < 1) return null;
  const username = trimmed.slice(0, at);
  if (username.length > EMAIL_USERNAME_MAX) return null;
  return username;
}
