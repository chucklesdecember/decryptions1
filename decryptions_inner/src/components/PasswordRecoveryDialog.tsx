import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { updatePassword, validatePassword } from "../lib/authApi";

export function PasswordRecoveryDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [password, setPassword] = useState(""); const [confirm, setConfirm] = useState(""); const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const submit = async (event: React.FormEvent) => { event.preventDefault(); const validation = validatePassword(password); if (validation) { setError(validation); return; } if (password !== confirm) { setError("Passwords do not match."); return; } setBusy(true); setError(null); try { const result = await updatePassword(password); if (!result.ok) { setError(result.message); return; } setPassword(""); setConfirm(""); onOpenChange(false); } finally { setBusy(false); } };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="sm:max-w-sm"><DialogHeader><DialogTitle>Choose a new password</DialogTitle><DialogDescription>Set a new password for your Decryptions account.</DialogDescription></DialogHeader><form onSubmit={submit} className="flex flex-col gap-4"><div className="flex flex-col gap-1.5"><Label htmlFor="new-password">New password</Label><Input id="new-password" type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} disabled={busy} autoFocus /></div><div className="flex flex-col gap-1.5"><Label htmlFor="confirm-password">Confirm new password</Label><Input id="confirm-password" type="password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} disabled={busy} /></div>{error && <p className="text-sm text-red-700">{error}</p>}<Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save new password"}</Button></form></DialogContent></Dialog>;
}
