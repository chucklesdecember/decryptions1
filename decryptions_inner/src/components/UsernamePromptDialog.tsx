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
}

export function UsernamePromptDialog({ open, onSave }: UsernamePromptDialogProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setValue("");
      setError(null);
    }
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = value.trim();
    if (!t) {
      setError("Please enter a username.");
      return;
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
            />
            {error && <p className="text-sm text-red-700 mt-2">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="submit" className="w-full bg-black hover:bg-gray-800 text-[#fffbea]">
              Continue
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
