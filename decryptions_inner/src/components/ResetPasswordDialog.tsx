import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { PASSWORD_MIN, updatePassword, validatePassword } from "../lib/authApi";

interface ResetPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Shown when the player arrives via a password-reset email link (Supabase PASSWORD_RECOVERY). */
export function ResetPasswordDialog({ open, onOpenChange }: ResetPasswordDialogProps) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setPassword("");
      setConfirm("");
      setError(null);
      setBusy(false);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = validatePassword(password) ?? (password === confirm ? null : "Passwords don't match.");
    if (v) {
      setError(v);
      return;
    }
    setBusy(true);
    setError(null);
    const res = await updatePassword(password);
    setBusy(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    toast.success("Password updated. You're logged in.");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Choose a new password</DialogTitle>
            <DialogDescription>At least {PASSWORD_MIN} characters.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reset-password">New password</Label>
            <Input
              id="reset-password"
              type="password"
              autoComplete="new-password"
              minLength={PASSWORD_MIN}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reset-password-confirm">Confirm password</Label>
            <Input
              id="reset-password-confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              disabled={busy}
            />
          </div>
          {error && <p className="text-sm text-red-700">{error}</p>}
          <Button
            type="submit"
            disabled={busy}
            className="h-11 w-full bg-black text-base font-medium text-[#fffbea] hover:bg-gray-800"
          >
            {busy ? "Saving…" : "Save password"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
