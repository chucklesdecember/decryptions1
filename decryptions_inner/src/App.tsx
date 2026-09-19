import React, { useState, useCallback, useEffect, useRef } from "react";
import { RebusPuzzle } from "./components/RebusPuzzle";
import { Timer } from "./components/Timer";
import { InstructionsDialog } from "./components/InstructionsDialog";
import { ShareDialog } from "./components/ShareDialog";
import { LandingPage } from "./components/LandingPage";
import { ArchiveDetail, ArchiveList } from "./components/ArchiveView";
import { Leaderboard } from "./components/Leaderboard";
import { LeaderboardPlacementPreview } from "./components/LeaderboardPlacementPreview";
import { AccountMenu } from "./components/AccountMenu";
import { Button } from "./components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./components/ui/alert-dialog";
import { Archive, Pause, Play, Trophy } from "lucide-react";
import { toast } from "sonner";
import { currentPuzzle, type Puzzle } from "./data/puzzles";
import {
  isPuzzleSolvedLocally,
  getStoredSolveSeconds,
  getStoredSolveHints,
  hasLeaderboardSubmittedLocally,
  getStoredLeaderboardRowId,
} from "./lib/decryptionsStorage";
import {
  fetchLeaderboardEntries,
  sliceAroundPlayer,
  type SolveEntry,
} from "./lib/leaderboardApi";
import { useAuth, type AuthKind } from "./lib/auth";
import posthog from "posthog-js";

type AppScreen = "landing" | "game" | "archive-list" | "archive-detail";

export default function App() {
  const auth = useAuth();
  const { recordSolve, requireAuth } = auth;

  const [screen, setScreen] = useState<AppScreen>("landing");
  const [archiveBackTarget, setArchiveBackTarget] = useState<"landing" | "game">("landing");
  const [archiveSelectedPuzzle, setArchiveSelectedPuzzle] = useState<Puzzle | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [isInstructionsOpen, setIsInstructionsOpen] = useState(false);
  const [isPuzzleComplete, setIsPuzzleComplete] = useState(false);
  const [solveTime, setSolveTime] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showLeaderboardView, setShowLeaderboardView] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  /** Player pressed Play while the session or progress sync was still loading. */
  const [startWhenReady, setStartWhenReady] = useState(false);
  /** Today's puzzle was already solved (on this device or, via sync, on another). */
  const [alreadySolved, setAlreadySolved] = useState(false);
  /** After a brand-new account is created: wait until instructions close, then call `beginGameSession`. */
  const pendingFirstStartAfterInstructionsRef = useRef(false);
  /** Prevents duplicate onComplete / double leaderboard submit in React Strict Mode. */
  const puzzleCompleteOnceRef = useRef(false);

  const [placementPreview, setPlacementPreview] = useState<{
    rank: number;
    slice: SolveEntry[];
    highlightIndex: number;
  } | null>(null);

  const solveTimeRef = useRef(0);
  const hintsUsedRef = useRef(0);
  useEffect(() => {
    solveTimeRef.current = solveTime;
  }, [solveTime]);
  useEffect(() => {
    hintsUsedRef.current = hintsUsed;
  }, [hintsUsed]);

  const isTimerActive =
    screen === "game" &&
    !isPaused &&
    !isInstructionsOpen &&
    !showLeaveConfirm &&
    !isPuzzleComplete;

  const openArchive = useCallback((from: "landing" | "game") => {
    setArchiveBackTarget(from);
    setScreen("archive-list");
    posthog.capture("archive_opened", { from });
  }, []);

  const handleSelectArchivePuzzle = useCallback((puzzle: Puzzle) => {
    setArchiveSelectedPuzzle(puzzle);
    setScreen("archive-detail");
    posthog.capture("archive_puzzle_opened", { puzzle_id: puzzle.id });
  }, []);

  const handleArchiveListBack = useCallback(() => {
    setScreen(archiveBackTarget);
  }, [archiveBackTarget]);

  const runPlacementPreview = useCallback(async (rowId: string) => {
    const entries = await fetchLeaderboardEntries(currentPuzzle.id);
    const sliced = sliceAroundPlayer(entries, rowId);
    if (sliced) {
      setPlacementPreview(sliced);
      posthog.capture("leaderboard_preview_shown", {
        puzzle_id: currentPuzzle.id,
        rank: sliced.rank,
      });
    }
  }, []);

  // Returning to an already-solved puzzle: show where the player placed.
  useEffect(() => {
    if (screen !== "game" || !isPuzzleComplete || !alreadySolved) return;
    const pid = currentPuzzle.id;
    if (!hasLeaderboardSubmittedLocally(pid)) return;
    const rid = getStoredLeaderboardRowId(pid);
    if (!rid) return;
    void runPlacementPreview(rid);
  }, [screen, isPuzzleComplete, alreadySolved, runPlacementPreview]);

  const handlePuzzleComplete = useCallback(() => {
    if (puzzleCompleteOnceRef.current) return;
    if (!isPuzzleComplete) {
      puzzleCompleteOnceRef.current = true;
      posthog.capture("puzzle_solved", {
        time_seconds: solveTimeRef.current,
        hints_used: hintsUsedRef.current,
      });
      setIsPuzzleComplete(true);
      setShowShareDialog(true);
      // Saves locally + to the account and posts to the leaderboard automatically.
      void recordSolve(currentPuzzle.id, solveTimeRef.current, hintsUsedRef.current).then(
        ({ rowId }) => {
          if (rowId) void runPlacementPreview(rowId);
        },
      );
    }
  }, [isPuzzleComplete, recordSolve, runPlacementPreview]);

  const handleUseHint = () => {
    setHintsUsed((prev) =>
      Math.min(prev + 1, currentPuzzle.hints.length),
    );
  };

  const handleTogglePause = () => {
    if (isPuzzleComplete) return;
    setIsPaused((prev) => !prev);
  };

  const beginGameSession = useCallback(() => {
    posthog.capture("puzzle_started");
    setScreen("game");
    setIsPaused(false);
    setIsInstructionsOpen(false);
    setShowShareDialog(false);
    setShowLeaderboardView(false);
    setShowLeaveConfirm(false);
    setPlacementPreview(null);
    puzzleCompleteOnceRef.current = false;

    const id = currentPuzzle.id;
    if (isPuzzleSolvedLocally(id)) {
      puzzleCompleteOnceRef.current = true;
      setIsPuzzleComplete(true);
      setSolveTime(getStoredSolveSeconds(id) ?? 0);
      setHintsUsed(getStoredSolveHints(id) ?? 0);
      setAlreadySolved(true);
    } else {
      setIsPuzzleComplete(false);
      setSolveTime(0);
      setHintsUsed(0);
      setAlreadySolved(false);
    }
  }, []);

  /** Runs once login (and the progress sync) finished from the Play button. */
  const afterAuth = useCallback(
    (kind: AuthKind) => {
      if (kind === "signup") {
        // First-time players read the instructions, then the game starts (see handleInstructionsOpenChange).
        pendingFirstStartAfterInstructionsRef.current = true;
        setIsInstructionsOpen(true);
      } else {
        beginGameSession();
      }
    },
    [beginGameSession],
  );

  const handlePlayClick = () => {
    posthog.capture("play_clicked");
    if (auth.status === "unavailable") {
      beginGameSession();
      return;
    }
    if (auth.status === "signed_in" && !auth.syncing) {
      beginGameSession();
      return;
    }
    if (auth.status === "signed_out") {
      requireAuth(afterAuth);
      return;
    }
    // Session still loading or progress still syncing: start as soon as it settles.
    if (auth.syncing) toast("Syncing your progress…");
    setStartWhenReady(true);
  };

  useEffect(() => {
    if (!startWhenReady) return;
    if (auth.status === "loading") return;
    if (auth.status === "signed_in" && auth.syncing) return;
    setStartWhenReady(false);
    if (auth.status === "signed_in" || auth.status === "unavailable") {
      beginGameSession();
    } else {
      requireAuth(afterAuth);
    }
  }, [startWhenReady, auth.status, auth.syncing, beginGameSession, requireAuth, afterAuth]);

  const handleInstructionsOpenChange = (open: boolean) => {
    setIsInstructionsOpen(open);
    if (!open && pendingFirstStartAfterInstructionsRef.current) {
      pendingFirstStartAfterInstructionsRef.current = false;
      beginGameSession();
    }
  };

  const goHome = useCallback(() => {
    setShowLeaveConfirm(false);
    setIsPaused(false);
    setScreen("landing");
    posthog.capture("home_clicked", { from: "game", puzzle_complete: isPuzzleComplete });
  }, [isPuzzleComplete]);

  const handleGoHome = () => {
    const inProgress = !isPuzzleComplete && (solveTime > 0 || hintsUsed > 0);
    if (inProgress) {
      setShowLeaveConfirm(true);
    } else {
      goHome();
    }
  };

  if (screen === "landing") {
    return (
      <>
        <LandingPage onStartGame={handlePlayClick} onOpenArchive={() => openArchive("landing")} />
        <InstructionsDialog
          open={isInstructionsOpen}
          onOpenChange={handleInstructionsOpenChange}
          showPlayButton
        />
      </>
    );
  }

  if (screen === "archive-list") {
    return (
      <ArchiveList onBack={handleArchiveListBack} onSelectPuzzle={handleSelectArchivePuzzle} />
    );
  }

  if (screen === "archive-detail" && archiveSelectedPuzzle) {
    return (
      <ArchiveDetail
        puzzle={archiveSelectedPuzzle}
        onBack={() => setScreen("archive-list")}
      />
    );
  }

  return (
    <div className="h-app flex flex-col bg-gradient-to-br from-orange-50 via-yellow-50 to-pink-50 overflow-hidden">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm shadow-sm flex-shrink-0">
        <div className="max-w-5xl mx-auto px-4 py-2.5">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <div className="min-w-0">
              {/* The title doubles as the home link */}
              <h1 className="whitespace-nowrap text-lg font-semibold leading-tight text-primary sm:text-xl">
                <button
                  type="button"
                  onClick={handleGoHome}
                  className="rounded-sm underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Decryptions home"
                  title="Back to home"
                >
                  Decryptions
                </button>
              </h1>
              {/* Tagline only where there is room; on phones the controls need the width. */}
              <p className="hidden text-xs text-muted-foreground sm:block">
                Decode the News, One Puzzle at a Time
              </p>
            </div>
            <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-1.5 sm:gap-2">
              <AccountMenu />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => openArchive("game")}
                className="h-9 shrink-0 gap-1.5 px-2.5 sm:px-3"
                aria-label="Archive"
              >
                <Archive className="h-4 w-4" />
                <span className="hidden sm:inline">Archive</span>
              </Button>
              <Timer
                isActive={isTimerActive}
                onTimeUpdate={setSolveTime}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleTogglePause}
                disabled={isPuzzleComplete}
                className="shrink-0"
                aria-label={isPaused ? "Resume" : "Pause"}
              >
                {isPaused ? (
                  <Play className="w-4 h-4" />
                ) : (
                  <Pause className="w-4 h-4" />
                )}
              </Button>
              <InstructionsDialog onOpenChange={handleInstructionsOpenChange} />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <div className="inline-block px-2.5 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs">
              {currentPuzzle.category}
            </div>
            <span className="text-xs text-muted-foreground">
              {currentPuzzle.date}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main
        className={`flex-1 overflow-y-auto overflow-x-hidden transition-all duration-300 ${isInstructionsOpen ? "blur-sm" : ""}`}
      >
        <div className="mx-auto flex max-w-5xl flex-col px-4 py-4 sm:py-6">
          {showLeaderboardView ? (
            <>
              <div className="mb-6 flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowLeaderboardView(false)}
                >
                  Back to puzzle
                </Button>
                <h2 className="text-lg font-semibold text-primary sm:text-xl">Results</h2>
              </div>

              <div className="p-4 bg-white rounded-xl shadow-md border border-border mb-4">
                <p className="text-xs text-muted-foreground mb-1">
                  {currentPuzzle.category} · {currentPuzzle.date}
                </p>
                <p className="text-sm">
                  <span className="text-muted-foreground">Headline: </span>
                  <span className="text-primary font-medium">{currentPuzzle.headline}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Your time:{" "}
                  <span className="tabular-nums text-foreground">
                    {Math.floor(solveTime / 60)}:{(solveTime % 60).toString().padStart(2, "0")}
                  </span>
                </p>
              </div>

              <Leaderboard
                puzzleId={currentPuzzle.id}
                solveTime={solveTime}
                isSolved={isPuzzleComplete}
                hintsUsed={hintsUsed}
                onSubmitted={(rowId) => {
                  void runPlacementPreview(rowId);
                }}
              />
            </>
          ) : (
            <>
              <div className="mb-4 text-center">
                <h2 className="mb-0.5 text-lg font-semibold text-primary sm:text-xl">
                  Today's Headline
                </h2>
                <p className="text-xs text-muted-foreground">
                  Solve the rebus puzzle to reveal the news!
                </p>
              </div>

              <div className="mb-3 flex items-center justify-center sm:mb-5">
                <RebusPuzzle
                  words={currentPuzzle.words}
                  onComplete={handlePuzzleComplete}
                  isPaused={isPaused}
                  hints={currentPuzzle.hints}
                  onUseHint={handleUseHint}
                  interactionLocked={alreadySolved || isPuzzleComplete}
                />
              </div>

              {isPuzzleComplete && placementPreview && !showLeaderboardView && (
                <LeaderboardPlacementPreview
                  rank={placementPreview.rank}
                  slice={placementPreview.slice}
                  highlightIndex={placementPreview.highlightIndex}
                />
              )}

              {/* Controls — Leaderboard + Share only after solve (hidden while playing) */}
              {isPuzzleComplete && (
                <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
                  <Button
                    type="button"
                    onClick={() => {
                      posthog.capture("leaderboard_opened");
                      setShowLeaderboardView(true);
                    }}
                    className="min-h-[48px] gap-2 px-5 text-white bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600"
                  >
                    <Trophy className="h-5 w-5 shrink-0 text-white" />
                    Leaderboard
                  </Button>
                  <Button
                    onClick={() => setShowShareDialog(true)}
                    className="min-h-[48px] gap-2 px-5 text-white bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600"
                  >
                    Share Results
                  </Button>
                </div>
              )}

              {/* Success Message */}
              {isPuzzleComplete && (
                <div className="p-4 bg-white rounded-xl shadow-md text-center border-2 border-green-200 mb-4">
                  <p className="text-2xl mb-1">🎉</p>
                  <h3 className="mb-1 text-lg font-semibold text-green-700">
                    {alreadySolved ? "Already completed" : "Congratulations!"}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {alreadySolved
                      ? "You already solved this puzzle. "
                      : "You've decoded today's headline: "}
                    <span className="text-primary">
                      "{currentPuzzle.headline}"
                    </span>
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Pause Overlay */}
      {isPaused && !isInstructionsOpen && !isPuzzleComplete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-2xl text-center max-w-sm mx-4">
            <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Pause className="w-8 h-8 text-white" />
            </div>
            <h2 className="mb-2 text-xl font-semibold text-primary">Game Paused</h2>
            <p className="text-muted-foreground mb-6">
              Take a break! Click below when you're ready to
              continue.
            </p>
            <Button
              onClick={handleTogglePause}
              size="lg"
              className="w-full gap-2 bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600"
            >
              <Play className="w-5 h-5" />
              Resume Game
            </Button>
          </div>
        </div>
      )}

      {/* Leaving mid-puzzle resets the timer; confirm first */}
      <AlertDialog open={showLeaveConfirm} onOpenChange={setShowLeaveConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave this puzzle?</AlertDialogTitle>
            <AlertDialogDescription>
              Your timer and answers will reset. You can start again from the home screen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep playing</AlertDialogCancel>
            <AlertDialogAction onClick={goHome}>Go home</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ShareDialog
        isOpen={showShareDialog}
        onOpenChange={setShowShareDialog}
        solveTime={solveTime}
        hintsUsed={hintsUsed}
        puzzleDate={currentPuzzle.date}
        puzzleId={currentPuzzle.id}
        articleUrl={currentPuzzle.articleUrl}
        playerRowId={getStoredLeaderboardRowId(currentPuzzle.id)}
        onLeaderboard={() => {
          setShowShareDialog(false);
          posthog.capture("leaderboard_opened");
          setShowLeaderboardView(true);
        }}
      />
    </div>
  );
}
