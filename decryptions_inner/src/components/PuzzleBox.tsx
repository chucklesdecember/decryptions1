import React, { forwardRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Button } from './ui/button';
import { Lightbulb } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { Input } from './ui/input';
import { cn } from './ui/utils';

/** Text clues (ink, cl, …) — height matches image tokens for alignment. */
const TEXT_TOKEN =
  'inline-flex min-h-10 shrink-0 items-center justify-center rounded-md border border-border bg-white px-2 py-1 text-xs font-semibold tabular-nums text-foreground shadow-sm sm:min-h-11 sm:px-2.5 sm:text-sm';

/** Operators / parentheses — vertically centered with tokens. */
const OP_TOKEN =
  'inline-flex shrink-0 select-none items-center justify-center text-sm font-medium leading-none text-foreground sm:text-base';

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
        <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border-2 border-border bg-white p-3 shadow-sm transition-shadow hover:shadow-md">
          <div className="mb-2 flex shrink-0 items-center justify-start">
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

          {/* Single wrapping row of tokens; min-w-0 + overflow-hidden on card prevents bleed into adjacent grid cells */}
          <div className="flex w-full min-w-0 flex-wrap content-center items-center justify-center gap-x-1 gap-y-2 sm:gap-x-1.5">
            {clues.map((clue, index) => (
              <div
                key={index}
                className="flex min-w-0 shrink-0 items-center justify-center"
              >
                {clue.type === 'image' && (() => {
                  const isBlink = clue.content === '/blink.png';
                  const isCue = clue.content === '/cue.png';
                  return (
                    <div
                      className={
                        isBlink
                          ? 'flex h-16 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted'
                          : isCue
                            ? 'flex h-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border min-w-0'
                            : 'flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted'
                      }
                      style={
                        isCue
                          ? {
                              /* 75% of full aspect width at h-12; grey tile behind cue art */
                              width: 'min(100%, calc(3rem * 1024 / 414 * 0.75))',
                              backgroundColor: '#e5e7eb',
                            }
                          : undefined
                      }
                    >
                      <ImageWithFallback
                        src={clue.content}
                        alt={clue.alt || 'puzzle clue'}
                        className="h-full w-full max-h-full object-contain object-center"
                      />
                    </div>
                  );
                })()}
                {clue.type === 'text' && (
                  <span className={TEXT_TOKEN}>{clue.content}</span>
                )}
                {clue.type === 'operator' && (
                  <span className={cn(OP_TOKEN, 'whitespace-pre')}>{clue.content}</span>
                )}
                {clue.type === 'symbol' && (
                  <span className="text-xl sm:text-2xl">{clue.content}</span>
                )}
              </div>
            ))}
          </div>
        </div>

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
