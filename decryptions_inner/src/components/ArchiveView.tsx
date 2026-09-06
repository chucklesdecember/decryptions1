import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RebusPuzzle } from "./RebusPuzzle";
import { Leaderboard } from "./Leaderboard";
import { AccountMenu } from "./AccountMenu";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import type { Puzzle } from "../data/puzzles";
import { getArchiveListPuzzles } from "../data/puzzles";
import {
  getLocallySolvedPuzzleIds,
  getStoredSolveHints,
  getStoredSolveSeconds,
  isPuzzleSolvedLocally,
} from "../lib/decryptionsStorage";
import { useAuth } from "../lib/auth";
import { ChevronLeft, LogIn } from "lucide-react";

interface ArchiveListProps {
  onBack: () => void;
  onSelectPuzzle: (puzzle: Puzzle) => void;
}

export function ArchiveList({ onBack, onSelectPuzzle }: ArchiveListProps) {
  const { progressVersion } = useAuth();
  const items = getArchiveListPuzzles();
  // Re-read solved state whenever synced progress changes.
  const solvedIds = useMemo(() => new Set(getLocallySolvedPuzzleIds()), [progressVersion]);

  return (
    <div className="h-app flex flex-col bg-gradient-to-br from-orange-50 via-yellow-50 to-pink-50 overflow-hidden">
      <header className="border-b bg-white/80 backdrop-blur-sm shadow-sm flex-shrink-0">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button type="button" variant="outline" size="sm" onClick={onBack} className="gap-1">
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-primary mb-0 text-lg font-semibold">Archive</h1>
            <p className="text-xs text-muted-foreground">Past puzzles and leaderboards</p>
          </div>
          <AccountMenu />
        </div>
      </header>
      <main className="flex-1 min-h-0">
        <ScrollArea className="h-full">
          <div className="max-w-5xl mx-auto px-4 py-6 space-y-2">
            {items.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-10">No past puzzles in the archive yet.</p>
            ) : null}
            {items.map((puzzle) => {
              const solved = solvedIds.has(puzzle.id);
              return (
                <button
                  key={puzzle.id}
                  type="button"
                  onClick={() => onSelectPuzzle(puzzle)}
                  className="w-full text-left rounded-xl border border-border bg-white p-4 shadow-sm transition-shadow hover:shadow-md hover:border-primary/30"
                >
                  <p className="text-xs text-muted-foreground mb-1">{puzzle.date}</p>
                  <p className="text-xs text-muted-foreground mb-1">{puzzle.category}</p>
                  {solved ? (
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
  const auth = useAuth();
  const { progressVersion, recordSolve, requireAuth } = auth;
  // Playable when signed in, or when accounts are not configured at all (local dev).
  const canPlay = auth.status === "signed_in" || auth.status === "unavailable";
  const needsLogin = auth.status === "signed_out";

  const [solvedHere, setSolvedHere] = useState(() => isPuzzleSolvedLocally(puzzle.id));
  const [hintsUsed, setHintsUsed] = useState(() => getStoredSolveHints(puzzle.id) ?? 0);
  const hintsUsedRef = useRef(hintsUsed);
  const startedAtRef = useRef<number | null>(null);
  const completeOnceRef = useRef(false);

  useEffect(() => {
    hintsUsedRef.current = hintsUsed;
  }, [hintsUsed]);

  // Reset per puzzle.
  useEffect(() => {
    const solved = isPuzzleSolvedLocally(puzzle.id);
    completeOnceRef.current = solved;
    setSolvedHere(solved);
    const h = getStoredSolveHints(puzzle.id) ?? 0;
    setHintsUsed(h);
    hintsUsedRef.current = h;
    startedAtRef.current = null;
  }, [puzzle.id]);

  // Adopt a solve that arrives via sync (e.g. logging in on this screen, or another device)
  // without disturbing a run that is in progress here.
  useEffect(() => {
    if (solvedHere) return;
    if (!isPuzzleSolvedLocally(puzzle.id)) return;
    completeOnceRef.current = true;
    startedAtRef.current = null;
    setSolvedHere(true);
    const h = getStoredSolveHints(puzzle.id) ?? 0;
    setHintsUsed(h);
    hintsUsedRef.current = h;
  }, [progressVersion, puzzle.id, solvedHere]);

  // The clock starts once the player can actually type (after login), not when the page opens.
  useEffect(() => {
    if (canPlay && !solvedHere && startedAtRef.current == null) {
      startedAtRef.current = Date.now();
    }
  }, [canPlay, solvedHere, puzzle.id]);

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
    startedAtRef.current = null;
    setSolvedHere(true);
    // Saves locally + to the account and posts to the leaderboard automatically.
    void recordSolve(puzzle.id, elapsed, hintsUsedRef.current);
  }, [puzzle.id, recordSolve]);

  const showHeadline = solvedHere;
  const solveSeconds = getStoredSolveSeconds(puzzle.id) ?? 0;
  const solveHintsStored = getStoredSolveHints(puzzle.id) ?? 0;

  return (
    <div className="h-app flex flex-col bg-gradient-to-br from-orange-50 via-yellow-50 to-pink-50 overflow-hidden">
      <header className="border-b bg-white/80 backdrop-blur-sm shadow-sm flex-shrink-0">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button type="button" variant="outline" size="sm" onClick={onBack} className="gap-1 shrink-0">
            <ChevronLeft className="h-4 w-4" />
            All puzzles
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-primary mb-0 text-lg font-semibold truncate">Past puzzle</h1>
            <p className="text-xs text-muted-foreground truncate">{puzzle.date}</p>
          </div>
          <AccountMenu />
        </div>
      </header>
      <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="p-4 bg-white rounded-xl shadow-md border border-border mb-6">
            <div className="inline-block px-2.5 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs mb-2">
              {puzzle.category}
            </div>
            {showHeadline ? (
              <h2 className="mb-1 text-xl font-semibold text-balance text-primary">{puzzle.headline}</h2>
            ) : (
              <p className="text-sm text-muted-foreground mb-1">
                Headline unlocks after you solve this puzzle.
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {solvedHere
                ? "You've completed this puzzle. Play today's puzzle from the home screen."
                : "Solve the rebus below. Your answers stay blank until you finish."}
            </p>
          </div>

          {needsLogin && !solvedHere && (
            <div className="mb-6 rounded-xl border-2 border-orange-200 bg-white p-4 text-center shadow-md">
              <h3 className="mb-1 text-lg font-semibold text-primary">Log in to play past puzzles</h3>
              <p className="mb-4 text-sm text-muted-foreground">
                A free account saves your progress and posts your time to this leaderboard.
              </p>
              <Button
                type="button"
                onClick={() => requireAuth()}
                className="h-11 gap-2 bg-black px-6 text-base font-semibold text-white hover:bg-gray-800"
              >
                <LogIn className="h-4 w-4" />
                Log in or sign up
              </Button>
            </div>
          )}

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
              inputsDisabled={!canPlay && !solvedHere}
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
