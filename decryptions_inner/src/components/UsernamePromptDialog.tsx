import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

interface UsernamePromptDialogProps {
  open: boolean;
  onSave: (username: string) => void;
  /** Return an error message if the name is invalid, or null if OK. */
  validateUsername?: (username: string) => Promise<string | null>;
}

export function UsernamePromptDialog({ open, onSave, validateUsername }: UsernamePromptDialogProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    if (open) {
      setValue("");
      setError(null);
      setIsChecking(false);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = value.trim();
    if (!t) {
      setError("Please enter a username.");
      return;
    }
    if (validateUsername) {
      setIsChecking(true);
      const msg = await validateUsername(t);
      setIsChecking(false);
      if (msg) {
        setError(msg);
        return;
      }
    }
    setError(null);
    onSave(t);
    setValue("");
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-sm [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Choose a username</DialogTitle>
            <DialogDescription>This name appears on the leaderboard.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Username"
              maxLength={40}
              autoComplete="username"
              autoFocus
              disabled={isChecking}
            />
            {error && <p className="text-sm text-red-700 mt-2">{error}</p>}
          </div>
          <DialogFooter>
            <Button
              type="submit"
              disabled={isChecking}
              className="w-full bg-black hover:bg-gray-800 text-[#fffbea]"
            >
              {isChecking ? "Checking…" : "Continue"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
