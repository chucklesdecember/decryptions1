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
  requestPasswordReset,
  signIn,
  signUp,
  validateEmail,
  validatePassword,
  validateUsername,
  PASSWORD_MIN,
  USERNAME_MAX,
  type AuthKind,
} from "../lib/authApi";
import { getStoredUsername, hasAccountBeenUsedOnDevice } from "../lib/decryptionsStorage";

const TURNSTILE_SITE_KEY = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined) || "";

interface AuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called right before credentials are sent, so the provider knows whether an account is being created. */
  onAttemptStart: (kind: AuthKind) => void;
  /** Called after Supabase accepted the credentials; resolves when the progress sync is done. */
  onAuthenticated: (kind: AuthKind, user: User) => Promise<void>;
}

type Tab = "login" | "signup";
type View = "tabs" | "forgot";

const PRIMARY_BUTTON = "h-11 w-full bg-black text-base font-medium text-[#fffbea] hover:bg-gray-800";

export function AuthDialog({ open, onOpenChange, onAttemptStart, onAuthenticated }: AuthDialogProps) {
  const [tab, setTab] = useState<Tab>("login");
  const [view, setView] = useState<View>("tabs");

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [signupUsername, setSignupUsername] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileInstance | null>(null);

  // Fresh state every time the dialog opens.
  useEffect(() => {
    if (!open) return;
    const legacyName = getStoredUsername() ?? "";
    // Devices that never logged in default to "Sign up"; returning devices default to "Log in".
    setTab(hasAccountBeenUsedOnDevice() ? "login" : "signup");
    setView("tabs");
    setLoginEmail("");
    setLoginPassword("");
    setSignupUsername(legacyName);
    setSignupEmail("");
    setSignupPassword("");
    setForgotEmail("");
    setError(null);
    setInfo(null);
    setBusy(false);
    setSyncing(false);
    setCaptchaToken(null);
  }, [open]);

  const captchaRequired = TURNSTILE_SITE_KEY.length > 0;
  const captchaPending = captchaRequired && !captchaToken;

  /** Turnstile tokens are single-use: get a fresh one after every attempt. */
  const resetCaptcha = () => {
    setCaptchaToken(null);
    turnstileRef.current?.reset();
  };

  const switchTab = (next: string) => {
    setTab(next as Tab);
    setError(null);
    setInfo(null);
    setCaptchaToken(null);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = validateEmail(loginEmail) ?? (loginPassword ? null : "Enter your password.");
    if (v) {
      setError(v);
      return;
    }
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      onAttemptStart("login");
      const res = await signIn({
        email: loginEmail,
        password: loginPassword,
        captchaToken: captchaToken ?? undefined,
      });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setSyncing(true);
      await onAuthenticated("login", res.user);
    } finally {
      setBusy(false);
      resetCaptcha();
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    const v =
      validateUsername(signupUsername) ?? validateEmail(signupEmail) ?? validatePassword(signupPassword);
    if (v) {
      setError(v);
      return;
    }
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const wanted = signupUsername.trim();
      const availability = await checkUsername(wanted);
      const legacyName = getStoredUsername()?.toLowerCase();
      const takenByAccount = availability === "taken_account";
      // A legacy anonymous name may only be claimed by the device that used it.
      const takenByStranger =
        availability === "taken_anonymous" && legacyName !== wanted.toLowerCase();
      if (takenByAccount || takenByStranger) {
        setError("That username is already taken. Try another.");
        return;
      }

      onAttemptStart("signup");
      const res = await signUp({
        email: signupEmail,
        password: signupPassword,
        username: wanted,
        captchaToken: captchaToken ?? undefined,
      });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      if (!res.session) {
        // Email confirmation is still enabled in Supabase.
        setInfo("Check your email for a confirmation link, then log in.");
        setLoginEmail(signupEmail);
        setTab("login");
        return;
      }
      setSyncing(true);
      await onAuthenticated("signup", res.user);
    } finally {
      setBusy(false);
      resetCaptcha();
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = validateEmail(forgotEmail);
    if (v) {
      setError(v);
      return;
    }
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const res = await requestPasswordReset(forgotEmail, captchaToken ?? undefined);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setInfo("If an account exists for that email, a reset link is on its way.");
    } finally {
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
            <DialogTitle className="text-base">Syncing your progress…</DialogTitle>
            <DialogDescription>Loading your solved puzzles and leaderboard times.</DialogDescription>
          </div>
        ) : view === "forgot" ? (
          <form onSubmit={handleForgot} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Reset your password</DialogTitle>
              <DialogDescription>We'll email you a link to choose a new password.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="auth-forgot-email">Email</Label>
              <Input
                id="auth-forgot-email"
                type="email"
                autoComplete="email"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                disabled={busy}
                autoFocus
              />
            </div>
            {captcha}
            {error && <p className="text-sm text-red-700">{error}</p>}
            {info && <p className="text-sm text-green-800">{info}</p>}
            <Button type="submit" disabled={submitDisabled} className={PRIMARY_BUTTON}>
              {busy ? "Sending…" : (submitHint ?? "Send reset link")}
            </Button>
            <button
              type="button"
              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
              onClick={() => {
                setView("tabs");
                setError(null);
                setInfo(null);
              }}
            >
              Back to log in
            </button>
          </form>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Log in or sign up</DialogTitle>
              <DialogDescription>
                A free account saves your progress across devices and posts your times to the
                leaderboard.
              </DialogDescription>
            </DialogHeader>

            <Tabs value={tab} onValueChange={switchTab} className="gap-4">
              <TabsList className="w-full">
                <TabsTrigger value="login">Log in</TabsTrigger>
                <TabsTrigger value="signup">Sign up</TabsTrigger>
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
                      onChange={(e) => setLoginEmail(e.target.value)}
                      disabled={busy}
                      autoFocus
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="auth-login-password">Password</Label>
                      <button
                        type="button"
                        className="text-xs text-muted-foreground underline-offset-4 hover:underline"
                        onClick={() => {
                          setForgotEmail(loginEmail);
                          setView("forgot");
                          setError(null);
                          setInfo(null);
                          setCaptchaToken(null);
                        }}
                      >
                        Forgot password?
                      </button>
                    </div>
                    <Input
                      id="auth-login-password"
                      type="password"
                      autoComplete="current-password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      disabled={busy}
                    />
                  </div>
                  {captcha}
                  {error && <p className="text-sm text-red-700">{error}</p>}
                  {info && <p className="text-sm text-green-800">{info}</p>}
                  <Button type="submit" disabled={submitDisabled} className={PRIMARY_BUTTON}>
                    {busy ? "Logging in…" : (submitHint ?? "Log in")}
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
                      onChange={(e) => setSignupUsername(e.target.value)}
                      disabled={busy}
                      autoFocus
                    />
                    <p className="text-xs text-muted-foreground">Shown on the leaderboard.</p>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="auth-signup-email">Email</Label>
                    <Input
                      id="auth-signup-email"
                      type="email"
                      autoComplete="email"
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      disabled={busy}
                    />
                    <p className="text-xs text-muted-foreground">Private. Used only to log in.</p>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="auth-signup-password">Password</Label>
                    <Input
                      id="auth-signup-password"
                      type="password"
                      autoComplete="new-password"
                      minLength={PASSWORD_MIN}
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      disabled={busy}
                    />
                    <p className="text-xs text-muted-foreground">At least {PASSWORD_MIN} characters.</p>
                  </div>
                  {captcha}
                  {error && <p className="text-sm text-red-700">{error}</p>}
                  {info && <p className="text-sm text-green-800">{info}</p>}
                  <Button type="submit" disabled={submitDisabled} className={PRIMARY_BUTTON}>
                    {busy ? "Creating account…" : (submitHint ?? "Create account")}
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
