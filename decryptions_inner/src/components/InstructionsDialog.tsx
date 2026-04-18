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
            Learn how to solve rebus puzzles and decode daily headlines.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <h4 className="mb-2 font-semibold text-foreground" style={{ textDecoration: 'underline', textUnderlineOffset: 3 }}>
              Goal
            </h4>
            <p className="text-sm text-muted-foreground">
              Decode the daily news headline by solving each rebus word.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Each box is one word; together they spell out the headline of the day.
            </p>
          </div>

          <div>
            <h4 className="mb-2 font-semibold text-foreground" style={{ textDecoration: 'underline', textUnderlineOffset: 3 }}>
              How Rebus Works
            </h4>
            <p className="text-sm text-muted-foreground mb-2">
              Each word is built from images, letters, and symbols that you combine.
            </p>
            <p className="text-sm text-muted-foreground mb-1">
              Example (subtraction): 🎺 - 👽 = TRUMP
            </p>
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Important:</span> When you see a minus (−),
              remove the second word from the first
            </p>
          </div>

          <div>
            <h4 className="mb-2 font-semibold text-foreground" style={{ textDecoration: 'underline', textUnderlineOffset: 3 }}>
              Tips
            </h4>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Say the sounds out loud</li>
              <li>Images often represent sounds or letters</li>
              <li>
                Beware of potential homophones: words that sound alike but spell differently (e.g. there, their,
                they&apos;re)
              </li>
              <li>Use hints if you get stuck</li>
            </ul>
          </div>

          <div>
            <h4 className="mb-2 font-semibold text-foreground" style={{ textDecoration: 'underline', textUnderlineOffset: 3 }}>
              Timer
            </h4>
            <p className="text-sm text-muted-foreground">
              Track how fast you solve the puzzle and try to beat your time
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
