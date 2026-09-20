import { useEffect, useRef, useState } from "react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import type { User } from "@supabase/supabase-js";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  checkUsername,
  createPasswordlessAccount,
  sendLoginLink,
  validateEmail,
  validateUsername,
  USERNAME_MAX,
  type AuthKind,
} from "../lib/authApi";
import { getStoredUsername, hasAccountBeenUsedOnDevice, rememberPuzzleForEmailConfirmation } from "../lib/decryptionsStorage";

const TURNSTILE_SITE_KEY = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined) || "";

interface AuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAuthenticated: (kind: AuthKind, user: User) => Promise<void>;
  initialUsername?: string;
}

type Tab = "login" | "signup";

const PRIMARY_BUTTON = "h-11 w-full bg-black text-base font-medium text-[#fffbea] hover:bg-gray-800";

export function AuthDialog({ open, onOpenChange, onAuthenticated, initialUsername }: AuthDialogProps) {
  const [tab, setTab] = useState<Tab>("login");
  const [loginEmail, setLoginEmail] = useState("");
  const [signupUsername, setSignupUsername] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileInstance | null>(null);

  useEffect(() => {
    if (!open) return;
    setTab(hasAccountBeenUsedOnDevice() ? "login" : "signup");
    setLoginEmail("");
    setSignupUsername(initialUsername ?? getStoredUsername() ?? "");
    setSignupEmail("");
    setError(null);
    setInfo(null);
    setBusy(false);
    setSyncing(false);
    setCaptchaToken(null);
  }, [open, initialUsername]);

  const captchaRequired = TURNSTILE_SITE_KEY.length > 0;
  const captchaPending = captchaRequired && !captchaToken;

  const resetCaptcha = () => {
    setCaptchaToken(null);
    turnstileRef.current?.reset();
  };

  const switchTab = (next: string) => {
    setTab(next as Tab);
    setError(null);
    setInfo(null);
    resetCaptcha();
  };

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    const validation = validateEmail(loginEmail);
    if (validation) {
      setError(validation);
      return;
    }

    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const result = await sendLoginLink({
        email: loginEmail,
        captchaToken: captchaToken ?? undefined,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setInfo("Check your email for a secure sign-in link. No password is needed.");
    } finally {
      setBusy(false);
      resetCaptcha();
    }
  };

  const handleSignup = async (event: React.FormEvent) => {
    event.preventDefault();
    const validation = validateUsername(signupUsername) ?? validateEmail(signupEmail);
    if (validation) {
      setError(validation);
      return;
    }

    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const wanted = signupUsername.trim();
      if (!initialUsername) {
        const availability = await checkUsername(wanted);
        const legacyName = getStoredUsername()?.toLowerCase();
        const takenByAccount = availability === "taken_account";
        const takenByStranger = availability === "taken_anonymous" && legacyName !== wanted.toLowerCase();
        if (takenByAccount || takenByStranger) {
          setError("That username is already taken. Try another.");
          return;
        }
      }

      const result = await createPasswordlessAccount({
        email: signupEmail,
        username: wanted,
        captchaToken: captchaToken ?? undefined,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }

      rememberPuzzleForEmailConfirmation();
      setSyncing(true);
      await onAuthenticated("signup", result.user);
    } finally {
      setSyncing(false);
      setBusy(false);
      resetCaptcha();
    }
  };

  const captcha = captchaRequired ? (
    <div className="flex min-h-[65px] justify-center">
      <Turnstile
        ref={turnstileRef}
        siteKey={TURNSTILE_SITE_KEY}
        onSuccess={(token) => setCaptchaToken(token)}
        onExpire={() => setCaptchaToken(null)}
        onError={() => setCaptchaToken(null)}
        options={{ theme: "light", size: "flexible" }}
      />
    </div>
  ) : null;

  const submitDisabled = busy || captchaPending;
  const submitHint = captchaPending ? "Checking you're human…" : null;

  return (
    <Dialog open={open} onOpenChange={(next) => !syncing && onOpenChange(next)}>
      <DialogContent className="sm:max-w-sm">
        {syncing ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
            <DialogTitle className="text-base">Starting your account…</DialogTitle>
            <DialogDescription>You can play now while your email confirmation is pending.</DialogDescription>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Log in or create account</DialogTitle>
              <DialogDescription>
                Password-free access. New players can start immediately and confirm their email afterward.
              </DialogDescription>
            </DialogHeader>

            <Tabs value={tab} onValueChange={switchTab} className="gap-4">
              <TabsList className="w-full">
                <TabsTrigger value="login">Log in</TabsTrigger>
                <TabsTrigger value="signup">Create account</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="auth-login-email">Email</Label>
                    <Input
                      id="auth-login-email"
                      type="email"
                      autoComplete="email"
                      value={loginEmail}
                      onChange={(event) => setLoginEmail(event.target.value)}
                      disabled={busy}
                      autoFocus
                    />
                    <p className="text-xs text-muted-foreground">We'll email you a secure sign-in link.</p>
                  </div>
                  {captcha}
                  {error && <p className="text-sm text-red-700">{error}</p>}
                  {info && <p className="text-sm text-green-800">{info}</p>}
                  <Button type="submit" disabled={submitDisabled} className={PRIMARY_BUTTON}>
                    {busy ? "Sending link…" : (submitHint ?? "Email me a sign-in link")}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignup} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="auth-signup-username">Username</Label>
                    <Input
                      id="auth-signup-username"
                      autoComplete="nickname"
                      maxLength={USERNAME_MAX}
                      value={signupUsername}
                      onChange={(event) => setSignupUsername(event.target.value)}
                      disabled={busy || !!initialUsername}
                      autoFocus
                    />
                    <p className="text-xs text-muted-foreground">
                      {initialUsername ? "Your guest leaderboard name will become your account username." : "Shown on the leaderboard."}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="auth-signup-email">Email</Label>
                    <Input
                      id="auth-signup-email"
                      type="email"
                      autoComplete="email"
                      value={signupEmail}
                      onChange={(event) => setSignupEmail(event.target.value)}
                      disabled={busy}
                    />
                    <p className="text-xs text-muted-foreground">
                      We'll send a confirmation email, but you can start playing immediately.
                    </p>
                  </div>
                  {captcha}
                  {error && <p className="text-sm text-red-700">{error}</p>}
                  <Button type="submit" disabled={submitDisabled} className={PRIMARY_BUTTON}>
                    {busy ? "Creating account…" : (submitHint ?? "Create account and play")}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
