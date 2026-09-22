import { useEffect, useRef, useState } from "react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import type { User } from "@supabase/supabase-js";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { checkUsername, createPasswordAccount, loginWithPassword, usernameFromEmail, validateEmail, validatePassword, type AuthKind } from "../lib/authApi";

const TURNSTILE_SITE_KEY = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined) || "";
const PRIMARY = "h-11 w-full bg-black text-base font-medium text-[#fffbea] hover:bg-gray-800";
type Mode = "login" | "signup";

export function AuthDialog({ open, onOpenChange, onAuthenticated, initialUsername }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAuthenticated: (kind: AuthKind, user: User) => Promise<void>;
  initialUsername?: string;
}) {
  const [mode, setMode] = useState<Mode>(initialUsername ? "signup" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileInstance | null>(null);

  useEffect(() => {
    if (!open) return;
    setMode(initialUsername ? "signup" : "login");
    setEmail(""); setPassword(""); setError(null); setBusy(false); setSyncing(false); setCaptchaToken(null);
  }, [open, initialUsername]);

  const captchaRequired = !!TURNSTILE_SITE_KEY;
  const resetCaptcha = () => { setCaptchaToken(null); turnstileRef.current?.reset(); };
  const captcha = captchaRequired ? <div className="flex min-h-[65px] justify-center"><Turnstile ref={turnstileRef} siteKey={TURNSTILE_SITE_KEY} onSuccess={setCaptchaToken} onExpire={() => setCaptchaToken(null)} onError={() => setCaptchaToken(null)} options={{ theme: "light", size: "flexible" }} /></div> : null;
  const changeMode = (next: Mode) => { setMode(next); setError(null); setPassword(""); resetCaptcha(); };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);
    if (emailError || passwordError) { setError(emailError ?? passwordError); return; }
    setBusy(true); setError(null);
    try {
      if (mode === "login") {
        const result = await loginWithPassword({ email, password, captchaToken: captchaToken ?? undefined });
        if (!result.ok) { setError(result.message); return; }
        setSyncing(true);
        await onAuthenticated("login", result.user);
        return;
      }
      const username = initialUsername ?? usernameFromEmail(email);
      if (!username) { setError("Use an email with a name before the @ sign."); return; }
      if (!initialUsername) {
        const availability = await checkUsername(username);
        if (availability !== "available") { setError("That email prefix is already in use. Try another email."); return; }
      }
      const result = await createPasswordAccount({ email, password, username, captchaToken: captchaToken ?? undefined });
      if (!result.ok) { setError(result.message); return; }
      setSyncing(true);
      await onAuthenticated("signup", result.user);
    } finally {
      setBusy(false); resetCaptcha();
    }
  };

  return <Dialog open={open} onOpenChange={next => !syncing && onOpenChange(next)}><DialogContent className="sm:max-w-sm">
    {syncing ? <div className="flex flex-col items-center gap-3 py-8 text-center"><Loader2 className="size-6 animate-spin text-muted-foreground" /><DialogTitle className="text-base">Saving your account…</DialogTitle></div> : <>
      <DialogHeader>
        <DialogTitle>{mode === "login" ? "Log in" : "Create an account"}</DialogTitle>
        <DialogDescription>{mode === "login" ? "Log in to access your archive and stats." : initialUsername ? `Keep ${initialUsername} on the leaderboard and unlock your archive and stats.` : "Save your progress and unlock the archive and stats."}</DialogDescription>
      </DialogHeader>
      <div className="mt-1 grid grid-cols-2 rounded-full bg-muted p-1" role="tablist" aria-label="Account options">
        <Button type="button" role="tab" aria-selected={mode === "login"} variant="ghost" className={mode === "login" ? "rounded-full bg-white shadow-sm hover:bg-white" : "rounded-full"} onClick={() => changeMode("login")}>Log in</Button>
        <Button type="button" role="tab" aria-selected={mode === "signup"} variant="ghost" className={mode === "signup" ? "rounded-full bg-white shadow-sm hover:bg-white" : "rounded-full"} onClick={() => changeMode("signup")}>Create account</Button>
      </div>
      <form onSubmit={submit} className="mt-4 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5"><Label htmlFor="account-email">Email</Label><Input id="account-email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} autoFocus disabled={busy} /></div>
        <div className="flex flex-col gap-1.5"><Label htmlFor="account-password">Password</Label><Input id="account-password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={e => setPassword(e.target.value)} disabled={busy} />{mode === "signup" && <p className="text-xs text-muted-foreground">At least 8 characters.</p>}</div>
        {captcha}{error && <p className="text-sm text-red-700" role="alert">{error}</p>}
        <Button type="submit" className={PRIMARY} disabled={busy || (captchaRequired && !captchaToken)}>{busy ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}</Button>
      </form>
    </>}
  </DialogContent></Dialog>;
}
