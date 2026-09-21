import { useEffect, useRef, useState } from "react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import type { User } from "@supabase/supabase-js";
import { Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { checkUsername, createGuest, USERNAME_MAX, validateUsername } from "../lib/authApi";
import { getStoredUsername } from "../lib/decryptionsStorage";

const TURNSTILE_SITE_KEY = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined) || "";

export function GuestDialog({ open, onOpenChange, onStarted }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStarted: (user: User) => Promise<void>;
}) {
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileInstance | null>(null);

  useEffect(() => {
    if (!open) return;
    setUsername(getStoredUsername() ?? "");
    setError(null);
    setBusy(false);
    setSyncing(false);
    setCaptchaToken(null);
  }, [open]);

  const captchaRequired = TURNSTILE_SITE_KEY.length > 0;
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const validation = validateUsername(username);
    if (validation) { setError(validation); return; }
    setBusy(true); setError(null);
    try {
      const wanted = username.trim();
      const availability = await checkUsername(wanted);
      if (availability !== "available") {
        setError("That name is already in use. Try another.");
        return;
      }
      const result = await createGuest({ username: wanted, captchaToken: captchaToken ?? undefined });
      if (!result.ok) { setError(result.message); return; }
      setSyncing(true);
      await onStarted(result.user);
    } finally {
      setBusy(false); setSyncing(false);
      setCaptchaToken(null); turnstileRef.current?.reset();
    }
  };

  return <Dialog open={open} onOpenChange={next => !syncing && onOpenChange(next)}>
    <DialogContent className="sm:max-w-sm">
      {syncing ? <div className="flex flex-col items-center gap-3 py-8 text-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
        <DialogTitle className="text-base">Starting as guest…</DialogTitle>
      </div> : <>
        <DialogHeader>
          <DialogTitle>Choose a username</DialogTitle>
          <DialogDescription>
            This is the name shown on today&apos;s leaderboard. Your play stays on this device.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="guest-username">Username</Label>
            <Input id="guest-username" autoComplete="nickname" maxLength={USERNAME_MAX}
              value={username} onChange={event => setUsername(event.target.value)} disabled={busy} autoFocus />
          </div>
          {captchaRequired && <div className="flex min-h-[65px] justify-center">
            <Turnstile ref={turnstileRef} siteKey={TURNSTILE_SITE_KEY}
              onSuccess={setCaptchaToken} onExpire={() => setCaptchaToken(null)} onError={() => setCaptchaToken(null)}
              options={{ theme: "light", size: "flexible" }} />
          </div>}
          {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
          <Button type="submit" disabled={busy || (captchaRequired && !captchaToken)}
            className="h-11 w-full bg-black text-base font-medium text-[#fffbea] hover:bg-gray-800">
            {busy ? "Checking name…" : "Start playing"}
          </Button>
        </form>
      </>}
    </DialogContent>
  </Dialog>;
}
