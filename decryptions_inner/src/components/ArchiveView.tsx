import { useCallback, useEffect, useRef, useState } from "react";
import { RebusPuzzle } from "./RebusPuzzle";
import { Leaderboard } from "./Leaderboard";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import type { Puzzle } from "../data/puzzles";
import { getArchiveListPuzzles } from "../data/puzzles";
import {
  getStoredSolveHints,
  getStoredSolveSeconds,
  isPuzzleSolvedLocally,
  markPuzzleSolvedLocally,
} from "../lib/decryptionsStorage";
import { ChevronLeft } from "lucide-react";

interface ArchiveListProps {
  onBack: () => void;
  onSelectPuzzle: (puzzle: Puzzle) => void;
}

export function ArchiveList({ onBack, onSelectPuzzle }: ArchiveListProps) {
  const items = getArchiveListPuzzles();

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-orange-50 via-yellow-50 to-pink-50 overflow-hidden">
      <header className="border-b bg-white/80 backdrop-blur-sm shadow-sm flex-shrink-0">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button type="button" variant="outline" size="sm" onClick={onBack} className="gap-1">
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-primary mb-0 text-lg font-semibold">Archive</h1>
            <p className="text-xs text-muted-foreground">Past puzzles and leaderboards</p>
          </div>
        </div>
      </header>
      <main className="flex-1 min-h-0">
        <ScrollArea className="h-full">
          <div className="max-w-5xl mx-auto px-4 py-6 space-y-2">
            {items.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-10">No past puzzles in the archive yet.</p>
            ) : null}
            {items.map((puzzle) => {
              const solvedHere = isPuzzleSolvedLocally(puzzle.id);
              return (
                <button
                  key={puzzle.id}
                  type="button"
                  onClick={() => onSelectPuzzle(puzzle)}
                  className="w-full text-left rounded-xl border border-border bg-white p-4 shadow-sm transition-shadow hover:shadow-md hover:border-primary/30"
                >
                  <p className="text-xs text-muted-foreground mb-1">{puzzle.date}</p>
                  <p className="text-xs text-muted-foreground mb-1">{puzzle.category}</p>
                  {solvedHere ? (
                    <p className="text-sm font-medium text-primary">{puzzle.headline}</p>
                  ) : null}
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </main>
    </div>
  );
}

interface ArchiveDetailProps {
  puzzle: Puzzle;
  onBack: () => void;
}

export function ArchiveDetail({ puzzle, onBack }: ArchiveDetailProps) {
  const [solvedHere, setSolvedHere] = useState(() => isPuzzleSolvedLocally(puzzle.id));
  const [hintsUsed, setHintsUsed] = useState(() => getStoredSolveHints(puzzle.id) ?? 0);
  const hintsUsedRef = useRef(hintsUsed);
  const startedAtRef = useRef<number | null>(null);
  const completeOnceRef = useRef(false);

  useEffect(() => {
    hintsUsedRef.current = hintsUsed;
  }, [hintsUsed]);

  useEffect(() => {
    completeOnceRef.current = false;
    const solved = isPuzzleSolvedLocally(puzzle.id);
    setSolvedHere(solved);
    const h = getStoredSolveHints(puzzle.id) ?? 0;
    setHintsUsed(h);
    hintsUsedRef.current = h;
    startedAtRef.current = solved ? null : Date.now();
  }, [puzzle.id]);

  const handleUseHint = useCallback(() => {
    setHintsUsed((prev) => {
      const n = Math.min(prev + 1, puzzle.hints.length);
      hintsUsedRef.current = n;
      return n;
    });
  }, [puzzle.hints.length]);

  const handleArchiveComplete = useCallback(() => {
    if (completeOnceRef.current) return;
    completeOnceRef.current = true;
    const elapsed =
      startedAtRef.current != null
        ? Math.max(0, Math.floor((Date.now() - startedAtRef.current) / 1000))
        : 0;
    markPuzzleSolvedLocally(puzzle.id, elapsed, hintsUsedRef.current);
    setSolvedHere(true);
    startedAtRef.current = null;
  }, [puzzle.id]);

  const showHeadline = solvedHere;
  const solveSeconds = getStoredSolveSeconds(puzzle.id) ?? 0;
  const solveHintsStored = getStoredSolveHints(puzzle.id) ?? 0;

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-orange-50 via-yellow-50 to-pink-50 overflow-hidden">
      <header className="border-b bg-white/80 backdrop-blur-sm shadow-sm flex-shrink-0">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button type="button" variant="outline" size="sm" onClick={onBack} className="gap-1">
            <ChevronLeft className="h-4 w-4" />
            All puzzles
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-primary mb-0 text-lg font-semibold truncate">Past puzzle</h1>
            <p className="text-xs text-muted-foreground truncate">{puzzle.date}</p>
          </div>
        </div>
      </header>
      <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="p-4 bg-white rounded-xl shadow-md border border-border mb-6">
            <div className="inline-block px-2.5 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs mb-2">
              {puzzle.category}
            </div>
            {showHeadline ? (
              <h2 className="text-primary text-xl font-semibold mb-1">{puzzle.headline}</h2>
            ) : (
              <p className="text-sm text-muted-foreground mb-1">
                Headline unlocks after you solve this puzzle on this device.
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {solvedHere
                ? "You've completed this puzzle here. Play today's puzzle from the home screen."
                : "Solve the rebus below. Your answers stay blank until you finish."}
            </p>
          </div>

          <div className="flex justify-center mb-8">
            <RebusPuzzle
              key={`${puzzle.id}-${solvedHere ? "done" : "play"}`}
              words={puzzle.words}
              hints={puzzle.hints}
              onComplete={handleArchiveComplete}
              completeOnAllWords
              isPaused={false}
              onUseHint={handleUseHint}
              interactionLocked={solvedHere}
            />
          </div>

          <Leaderboard
            puzzleId={puzzle.id}
            solveTime={solveSeconds}
            isSolved={solvedHere}
            hintsUsed={solvedHere ? solveHintsStored : hintsUsed}
          />
        </div>
      </main>
    </div>
  );
}
