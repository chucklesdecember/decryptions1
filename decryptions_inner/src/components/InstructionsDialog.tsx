import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import { Button } from './ui/button';
import { HelpCircle, Play } from 'lucide-react';

interface InstructionsDialogProps {
  onOpenChange?: (open: boolean) => void;
  /** When set, dialog is controlled (no toolbar trigger); parent drives `open`. */
  open?: boolean;
  /** Big primary action at bottom (e.g. first-time onboarding); still keep dialog close (X). */
  showPlayButton?: boolean;
}

export function InstructionsDialog({ onOpenChange, open, showPlayButton }: InstructionsDialogProps) {
  const isControlled = open !== undefined;
  return (
    <Dialog open={isControlled ? open : undefined} onOpenChange={onOpenChange}>
      {!isControlled && (
        <DialogTrigger asChild>
          <Button variant="outline" size="icon">
            <HelpCircle className="w-5 h-5" />
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>How to Play Decryptions</DialogTitle>
          <DialogDescription>
            Learn how to solve rebus puzzles and decode the daily headlines.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <h4 className="mb-2">🎯 Goal</h4>
            <p className="text-sm text-muted-foreground">
              Decode the daily news headline by solving each rebus puzzle word.
            </p>
          </div>
          
          <div>
            <h4 className="mb-2">🧩 How Rebus Works</h4>
            <p className="text-sm text-muted-foreground mb-2">
              Each word is represented by a combination of images, letters, and symbols that you add together (like PEMDAS!).
            </p>
            <p className="text-sm text-muted-foreground">
              Example: 🐝 + "GIN" = BEGIN
            </p>
          </div>

          <div>
            <h4 className="mb-2">💡 Tips</h4>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Look at each clue from left to right</li>
              <li>Add the sounds together</li>
              <li>Think about how images sound phonetically</li>
              <li>Use hints if you get stuck!</li>
            </ul>
          </div>

          <div>
            <h4 className="mb-2">⏱️ Timer</h4>
            <p className="text-sm text-muted-foreground">
              Track how fast you can solve the puzzle and challenge yourself to beat your time!
            </p>
          </div>
        </div>
        {showPlayButton && (
          <div className="border-t pt-4 mt-2">
            <Button
              type="button"
              size="xl"
              className="w-full text-base font-semibold"
              onClick={() => onOpenChange?.(false)}
            >
              <Play className="size-5" />
              Play
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
