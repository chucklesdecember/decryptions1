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
      <DialogContent className="max-w-md gap-2 p-4 pt-12 sm:gap-2 sm:p-5 sm:pt-12">
        <DialogHeader className="gap-1.5">
          <DialogTitle>How to Play Decryptions</DialogTitle>
          <DialogDescription>Solve rebus puzzles to decode the daily headline.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm text-muted-foreground">
          <div>
            <h4
              className="mb-1 font-semibold text-foreground"
              style={{ textDecoration: 'underline', textUnderlineOffset: 3 }}
            >
              Goal
            </h4>
            <p>Decode each word to reveal the full news headline.</p>
            <p className="mt-1.5">Each box = one word.</p>
          </div>

          <div>
            <h4
              className="mb-1 font-semibold text-foreground"
              style={{ textDecoration: 'underline', textUnderlineOffset: 3 }}
            >
              How It Works
            </h4>
            <p className="mb-1.5">Words are built from images, letters, and symbols you combine.</p>
            <p className="mb-0.5">Example (subtraction): 🎺 − 👽 = TRUMP</p>
            <p>When you see a minus (−), remove the 2nd word from the 1st.</p>
          </div>

          <div>
            <h4
              className="mb-1 font-semibold text-foreground"
              style={{ textDecoration: 'underline', textUnderlineOffset: 3 }}
            >
              Tips
            </h4>
            <ul className="list-inside list-disc space-y-0.5">
              <li>Images can represent sounds or letters</li>
              <li>Look for homophones (same sound, different spelling)</li>
              <li>The number in the top right shows how many letters the answer has.</li>
              <li>Use hints if needed</li>
            </ul>
          </div>

          <div>
            <h4
              className="mb-1 font-semibold text-foreground"
              style={{ textDecoration: 'underline', textUnderlineOffset: 3 }}
            >
              Timer
            </h4>
            <p>Track your time and try to beat your best score.</p>
            {showPlayButton ? (
              <div className="mt-2 border-t border-border pt-2">
                <Button
                  type="button"
                  size="xl"
                  className="w-full text-base font-semibold"
                  onClick={() => onOpenChange?.(false)}
                >
                  <Play className="size-5" />
                  Play
                </Button>
                <p className="mt-1.5 text-center text-xs text-muted-foreground">Or tap ✕ above to close</p>
              </div>
            ) : (
              <p className="mt-2 text-center text-xs text-muted-foreground">
                Tap ✕ above or outside this box to close
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
