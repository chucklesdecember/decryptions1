import React, { forwardRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Button } from './ui/button';
import { Lightbulb } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { Input } from './ui/input';

/** Text clues (ink, cl, …) — height matches image tokens for alignment. */
const TEXT_TOKEN =
  'inline-flex min-h-10 shrink-0 items-center justify-center rounded-md border border-border bg-white px-2 py-1 text-xs font-semibold tabular-nums text-foreground shadow-sm sm:min-h-11 sm:px-2.5 sm:text-sm';

/** Operators / parentheses — vertically centered with tokens. */
const OP_TOKEN =
  'inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap text-sm font-medium leading-none text-foreground sm:text-base';

/**
 * Image tile: fixed 3rem height; width follows the picture's aspect ratio between a square
 * minimum and a 6rem maximum, so wide logos and tall drawings are never stretched.
 * Light mat inside the tile so dark / transparent PNGs read clearly against the card.
 */
const IMAGE_TILE =
  'flex h-12 min-w-12 max-w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-neutral-100 p-1';

interface PuzzleClue {
  type: 'image' | 'text' | 'symbol' | 'operator';
  content: string;
  alt?: string;
}

/**
 * Group clues so a parenthesised sub-expression such as "( 🖼 - 🖼 )" always stays on one line
 * when the row wraps. Operator strings like ") + (" are split into their paren and connector
 * parts; a connector between groups is attached to the front of the group that follows it.
 */
function groupClues(clues: PuzzleClue[]): PuzzleClue[][] {
  const groups: PuzzleClue[][] = [];
  let open: PuzzleClue[] | null = null;
  let depth = 0;
  const add = (clue: PuzzleClue) => {
    if (open) open.push(clue);
    else groups.push([clue]);
  };

  for (const clue of clues) {
    if (clue.type !== 'operator') {
      add(clue);
      continue;
    }
    for (const part of clue.content.split(/([()])/)) {
      if (part === '(') {
        if (depth === 0) {
          open = [];
          groups.push(open);
        }
        depth++;
        add({ type: 'operator', content: '(' });
      } else if (part === ')') {
        add({ type: 'operator', content: ')' });
        if (depth > 0) depth--;
        if (depth === 0) open = null;
      } else if (part.trim() !== '') {
        add({ type: 'operator', content: part.trim() });
      }
    }
  }

  // A bare connector ("+", "-", "+ IA") between groups joins the group after it, so a line
  // break lands before the operator instead of stranding it at the end of a line.
  const merged: PuzzleClue[][] = [];
  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    const isConnector =
      group.length === 1 && group[0].type === 'operator' && group[0].content !== '(' && group[0].content !== ')';
    if (isConnector && i < groups.length - 1) {
      groups[i + 1].unshift(...group);
    } else {
      merged.push(group);
    }
  }
  return merged;
}

function ClueToken({ clue }: { clue: PuzzleClue }) {
  if (clue.type === 'image') {
    return (
      <div className={IMAGE_TILE}>
        <ImageWithFallback
          src={clue.content}
          alt={clue.alt || 'puzzle clue'}
          className="h-full w-auto max-w-[5.5rem] object-contain"
        />
      </div>
    );
  }
  if (clue.type === 'text') return <span className={TEXT_TOKEN}>{clue.content}</span>;
  if (clue.type === 'operator') return <span className={OP_TOKEN}>{clue.content}</span>;
  return <span className="text-xl sm:text-2xl">{clue.content}</span>;
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
    const groups = groupClues(clues);

    return (
      <div className="flex min-w-0 w-full flex-col gap-2">
        <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border-2 border-border bg-white p-3 shadow-sm transition-shadow hover:shadow-md">
          <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
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
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Hint</DialogTitle>
                </DialogHeader>
                <div className="rounded-lg bg-accent p-3">
                  <p className="text-sm">{hint}</p>
                </div>
              </DialogContent>
            </Dialog>
            <span
              className="min-w-6 text-center text-xs font-semibold tabular-nums leading-none text-muted-foreground"
              aria-label={`Answer length: ${answer.length} letters`}
            >
              {answer.length}
            </span>
          </div>

          {/* Wrapping row of clue groups. Line breaks only happen between groups, never inside "( … )". */}
          <div className="flex w-full min-w-0 flex-wrap content-center items-center justify-center gap-x-1.5 gap-y-2 sm:gap-x-2">
            {groups.map((group, groupIndex) => (
              <div
                key={groupIndex}
                className="flex max-w-full flex-wrap items-center justify-center gap-x-1 gap-y-2 sm:gap-x-1.5"
              >
                {group.map((clue, clueIndex) => (
                  <ClueToken key={clueIndex} clue={clue} />
                ))}
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
          className={`h-9 rounded-lg border-2 text-center uppercase transition-all placeholder:normal-case ${
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
