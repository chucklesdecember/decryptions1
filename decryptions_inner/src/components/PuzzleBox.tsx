import React, { forwardRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Button } from './ui/button';
import { Lightbulb } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { Input } from './ui/input';

interface PuzzleClue {
  type: 'image' | 'text' | 'symbol' | 'operator';
  content: string;
  alt?: string;
}

interface PuzzleBoxProps {
  clues: PuzzleClue[];
  answer: string;
  userInput: string;
  onInputChange: (value: string) => void;
  isCorrect: boolean;
  isPaused?: boolean;
  hint: string;
  onRevealHint: () => void;
  /** Read-only: puzzle already completed on this device */
  locked?: boolean;
}

export const PuzzleBox = forwardRef<HTMLInputElement, PuzzleBoxProps>(
  (
    {
      clues,
      answer,
      userInput,
      onInputChange,
      isCorrect,
      isPaused = false,
      hint,
      onRevealHint,
      locked = false,
    },
    ref,
  ) => {
    return (
      <div className="flex min-w-0 w-full flex-col gap-2">
        {/* Anchor: positioned card; hint is absolute inside this box only (not the page). */}
        <div className="relative isolate z-0 min-w-0 overflow-visible rounded-xl border-2 border-border bg-white p-3 pl-12 min-h-[110px] shadow-sm transition-shadow hover:shadow-md">
          <div className="absolute left-2 top-2 z-10">
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={onRevealHint}
                  disabled={locked}
                  type="button"
                  aria-label="Show hint"
                >
                  <Lightbulb className="w-4 h-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Hint</DialogTitle>
                </DialogHeader>
                <div className="p-3 bg-accent rounded-lg">
                  <p className="text-sm">{hint}</p>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            {clues.map((clue, index) => (
              <div key={index} className="flex items-center gap-1.5">
                {clue.type === 'image' && (
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex items-center justify-center shadow-sm border border-border">
                    <ImageWithFallback
                      src={clue.content}
                      alt={clue.alt || 'puzzle clue'}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                {clue.type === 'text' && (
                  <span className="px-2.5 py-1.5 bg-white border border-border text-foreground rounded-lg shadow-sm min-w-[2.5rem] text-center">
                    {clue.content}
                  </span>
                )}
                {clue.type === 'operator' && (
                  <span className="text-foreground mx-0.5 whitespace-pre">
                    {clue.content}
                  </span>
                )}
                {clue.type === 'symbol' && (
                  <span className="text-2xl">{clue.content}</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Answer Input */}
        <Input
          ref={ref}
          type="text"
          value={userInput}
          onChange={(e) => onInputChange(e.target.value.toUpperCase())}
          placeholder="Type your answer..."
          className={`text-center uppercase h-9 border-2 rounded-lg transition-all ${
            isCorrect
              ? 'bg-green-50 border-green-500 text-green-700 shadow-sm'
              : userInput && !isCorrect && userInput.length === answer.length
              ? 'bg-red-50 border-red-500 text-red-700'
              : 'bg-white border-border hover:border-primary/50 focus:border-primary'
          }`}
          disabled={isCorrect || isPaused || locked}
          readOnly={locked}
        />
      </div>
    );
  }
);

PuzzleBox.displayName = 'PuzzleBox';
