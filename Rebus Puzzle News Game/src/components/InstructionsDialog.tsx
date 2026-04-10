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
import { HelpCircle } from 'lucide-react';

interface InstructionsDialogProps {
  onOpenChange?: (open: boolean) => void;
}

export function InstructionsDialog({ onOpenChange }: InstructionsDialogProps) {
  return (
    <Dialog onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon">
          <HelpCircle className="w-5 h-5" />
        </Button>
      </DialogTrigger>
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
      </DialogContent>
    </Dialog>
  );
}
