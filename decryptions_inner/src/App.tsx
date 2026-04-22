import React, { useState, useCallback, useEffect, useRef } from "react";
import { RebusPuzzle } from "./components/RebusPuzzle";
import { Timer } from "./components/Timer";
import { InstructionsDialog } from "./components/InstructionsDialog";
import { ShareDialog } from "./components/ShareDialog";
import { LandingPage } from "./components/LandingPage";
import { ArchiveDetail, ArchiveList } from "./components/ArchiveView";
import { Leaderboard } from "./components/Leaderboard";
import { LeaderboardPlacementPreview } from "./components/LeaderboardPlacementPreview";
import { UsernamePromptDialog } from "./components/UsernamePromptDialog";
import { Button } from "./components/ui/button";
import { Archive, Pause, Play, Trophy } from "lucide-react";
import { Toaster } from "./components/ui/sonner";
import { toast } from "sonner";
import { currentPuzzle, type Puzzle } from "./data/puzzles";
import {
  getStoredUsername,
  setStoredUsername,
  isPuzzleSolvedLocally,
  getStoredSolveSeconds,
  getStoredSolveHints,
  markPuzzleSolvedLocally,
  hasLeaderboardSubmittedLocally,
  markLeaderboardSubmittedLocally,
  getStoredLeaderboardRowId,
  setStoredLeaderboardRowId,
} from "./lib/decryptionsStorage";
import {
  fetchLeaderboardEntries,
  isDisplayNameTakenByAnother,
  submitLeaderboardScore,
  sliceAroundPlayer,
  type SolveEntry,
} from "./lib/leaderboardApi";
import { supabase } from "./lib/supabase";
import posthog from "posthog-js";

type AppScreen = "landing" | "game" | "archive-list" | "archive-detail";

export default function App() {
  const [screen, setScreen] = useState<AppScreen>("landing");
  const [archiveBackTarget, setArchiveBackTarget] = useState<"landing" | "game">("landing");
  const [archiveSelectedPuzzle, setArchiveSelectedPuzzle] = useState<Puzzle | null>(null);
  const [showUsernamePrompt, setShowUsernamePrompt] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isInstructionsOpen, setIsInstructionsOpen] = useState(false);
  const [isPuzzleComplete, setIsPuzzleComplete] = useState(false);
  const [solveTime, setSolveTime] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showLeaderboardView, setShowLeaderboardView] = useState(false);
  const [alreadySolvedOnDevice, setAlreadySolvedOnDevice] = useState(false);
  /** After first-time username save: wait until instructions close, then call `beginGameSession`. */
  const pendingFirstStartAfterInstructionsRef = useRef(false);
  const leaderboardSubmitLockRef = useRef(false);
  /** Prevents duplicate onComplete / double leaderboard submit in React Strict Mode. */
  const puzzleCompleteOnceRef = useRef(false);

  const [placementPreview, setPlacementPreview] = useState<{
    rank: number;
    slice: SolveEntry[];
    highlightIndex: number;
  } | null>(null);
  const [showPostSolveUsernamePrompt, setShowPostSolveUsernamePrompt] = useState(false);

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

  const validateUsername = useCallback(async (username: string): Promise<string | null> => {
    const taken = await isDisplayNameTakenByAnother(username.trim());
    return taken ? "That username is already taken. Try another." : null;
  }, []);

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
  }, [currentPuzzle.id]);

  const submitLeaderboardAfterSolve = useCallback(async () => {
    if (!supabase) return;
    const puzzleId = currentPuzzle.id;
    if (hasLeaderboardSubmittedLocally(puzzleId)) {
      const rid = getStoredLeaderboardRowId(puzzleId);
      if (rid) await runPlacementPreview(rid);
      return;
    }
    if (leaderboardSubmitLockRef.current) return;
    const name = getStoredUsername()?.trim();
    if (!name) {
      setShowPostSolveUsernamePrompt(true);
      return;
    }
    if (await isDisplayNameTakenByAnother(name)) {
      setShowPostSolveUsernamePrompt(true);
      return;
    }
    leaderboardSubmitLockRef.current = true;
    const res = await submitLeaderboardScore({
      puzzleId,
      displayName: name,
      timeSeconds: solveTimeRef.current,
      hintsUsed: hintsUsedRef.current,
    });
    if (res.ok) {
      markLeaderboardSubmittedLocally(puzzleId);
      setStoredLeaderboardRowId(puzzleId, res.id);
      posthog.capture("leaderboard_auto_submitted", { puzzle_id: puzzleId });
      await runPlacementPreview(res.id);
    } else if (res.error === "duplicate") {
      setShowPostSolveUsernamePrompt(true);
      toast.error("That username is already taken. Choose another.");
    }
    leaderboardSubmitLockRef.current = false;
  }, [currentPuzzle.id, runPlacementPreview]);

  const handlePostSolveUsernameSave = useCallback(
    (username: string) => {
      setStoredUsername(username);
      setShowPostSolveUsernamePrompt(false);
      void (async () => {
        if (!supabase) return;
        const puzzleId = currentPuzzle.id;
        if (hasLeaderboardSubmittedLocally(puzzleId)) return;
        if (leaderboardSubmitLockRef.current) return;
        leaderboardSubmitLockRef.current = true;
        const res = await submitLeaderboardScore({
          puzzleId,
          displayName: username.trim(),
          timeSeconds: solveTimeRef.current,
          hintsUsed: hintsUsedRef.current,
        });
        if (res.ok) {
          markLeaderboardSubmittedLocally(puzzleId);
          setStoredLeaderboardRowId(puzzleId, res.id);
          posthog.capture("leaderboard_auto_submitted", {
            puzzle_id: puzzleId,
            source: "post_solve_username",
          });
          await runPlacementPreview(res.id);
        } else if (res.error === "duplicate") {
          toast.error("That username is already taken. Choose another.");
          setShowPostSolveUsernamePrompt(true);
        }
        leaderboardSubmitLockRef.current = false;
      })();
    },
    [currentPuzzle.id, runPlacementPreview],
  );

  useEffect(() => {
    if (screen !== "game" || !isPuzzleComplete || !alreadySolvedOnDevice) return;
    const pid = currentPuzzle.id;
    if (!hasLeaderboardSubmittedLocally(pid)) return;
    const rid = getStoredLeaderboardRowId(pid);
    if (!rid) return;
    void runPlacementPreview(rid);
  }, [
    screen,
    isPuzzleComplete,
    alreadySolvedOnDevice,
    currentPuzzle.id,
    runPlacementPreview,
  ]);

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
      markPuzzleSolvedLocally(
        currentPuzzle.id,
        solveTimeRef.current,
        hintsUsedRef.current,
      );
      void submitLeaderboardAfterSolve();
    }
  }, [isPuzzleComplete, submitLeaderboardAfterSolve]);

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
    setShowUsernamePrompt(false);
    setIsPaused(false);
    setIsInstructionsOpen(false);
    setShowShareDialog(false);
    setShowLeaderboardView(false);
    setPlacementPreview(null);
    setShowPostSolveUsernamePrompt(false);
    puzzleCompleteOnceRef.current = false;

    const id = currentPuzzle.id;
    if (isPuzzleSolvedLocally(id)) {
      puzzleCompleteOnceRef.current = true;
      setIsPuzzleComplete(true);
      setSolveTime(getStoredSolveSeconds(id) ?? 0);
      setHintsUsed(getStoredSolveHints(id) ?? 0);
      setAlreadySolvedOnDevice(true);
    } else {
      setIsPuzzleComplete(false);
      setSolveTime(0);
      setHintsUsed(0);
      setAlreadySolvedOnDevice(false);
    }
  }, []);

  const handlePlayClick = () => {
    posthog.capture("play_clicked");
    if (getStoredUsername()) {
      beginGameSession();
    } else {
      setShowUsernamePrompt(true);
    }
  };

  const handleUsernameSave = (username: string) => {
    setStoredUsername(username);
    setShowUsernamePrompt(false);
    pendingFirstStartAfterInstructionsRef.current = true;
    setIsInstructionsOpen(true);
  };

  const handleInstructionsOpenChange = (open: boolean) => {
    setIsInstructionsOpen(open);
    if (!open && pendingFirstStartAfterInstructionsRef.current) {
      pendingFirstStartAfterInstructionsRef.current = false;
      beginGameSession();
    }
  };

  if (screen === "landing") {
    return (
      <>
        <LandingPage onStartGame={handlePlayClick} onOpenArchive={() => openArchive("landing")} />
        <UsernamePromptDialog
          open={showUsernamePrompt}
          onSave={handleUsernameSave}
          validateUsername={validateUsername}
        />
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
    <div className="h-screen flex flex-col bg-gradient-to-br from-orange-50 via-yellow-50 to-pink-50 overflow-hidden">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm shadow-sm flex-shrink-0">
        <div className="max-w-5xl mx-auto px-4 py-2.5">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-primary mb-0.5">
                Decryptions
              </h1>
              <p className="text-xs text-muted-foreground">
                Decode the News, One Puzzle at a Time
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => openArchive("game")}
                className="gap-1.5 shrink-0"
              >
                <Archive className="h-4 w-4" />
                Archive
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

          <div className="flex items-center gap-2">
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
              <div className="flex items-center gap-3 mb-6">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowLeaderboardView(false)}
                >
                  Back to puzzle
                </Button>
                <h2 className="text-primary mb-0">Results</h2>
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
                <h2 className="text-primary mb-0.5">
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
                  interactionLocked={alreadySolvedOnDevice || isPuzzleComplete}
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
                  <h3 className="text-green-700 mb-1">
                    {alreadySolvedOnDevice
                      ? "Already completed on this device"
                      : "Congratulations!"}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {alreadySolvedOnDevice
                      ? "You already solved this puzzle on this device. "
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
          <div className="bg-white rounded-2xl p-8 shadow-2xl text-center max-w-sm mx-4">
            <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Pause className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-primary mb-2">Game Paused</h2>
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

      <UsernamePromptDialog
        open={showPostSolveUsernamePrompt}
        onSave={handlePostSolveUsernameSave}
        validateUsername={validateUsername}
      />

      <Toaster richColors position="top-center" />
    </div>
  );
}