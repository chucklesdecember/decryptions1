import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { cn } from "./ui/utils";
import { Share2, Check, Copy, Trophy } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import posthog from "posthog-js";
import {
  fetchLeaderboardEntries,
  sliceAroundPlayer,
  type SolveEntry,
} from "../lib/leaderboardApi";
import { LeaderboardPlacementPreview } from "./LeaderboardPlacementPreview";

interface ShareDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  solveTime: number;
  hintsUsed: number;
  /** Daily puzzle date label, e.g. "April 14, 2026" */
  puzzleDate: string;
  puzzleId: string;
  /** Player's row in `solves` after submit (localStorage); used to slice the leaderboard */
  playerRowId: string | null;
  onLeaderboard?: () => void;
}

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatShortDate(puzzleDate: string): string {
  const t = Date.parse(puzzleDate);
  if (!Number.isNaN(t)) {
    return new Date(t).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
  return puzzleDate;
}

/** Text-only summary for copy / system share (no leaderboard block). */
function buildCopyableShareText(dateStr: string, solveTime: number, hintsUsed: number): string {
  return `🔐 Decryptions — ${dateStr}

⏱️ My time: ${formatTime(solveTime)}
💡 ${hintsUsed} hint${hintsUsed !== 1 ? "s" : ""} used

https://decryptions1.vercel.app/`;
}

export function ShareDialog({
  isOpen,
  onOpenChange,
  solveTime,
  hintsUsed,
  puzzleDate,
  puzzleId,
  playerRowId,
  onLeaderboard,
}: ShareDialogProps) {
  const [copied, setCopied] = useState(false);
  const [placementLoading, setPlacementLoading] = useState(false);
  const [placement, setPlacement] = useState<{
    rank: number;
    slice: SolveEntry[];
    highlightIndex: number;
  } | null>(null);

  const dateStr = formatShortDate(puzzleDate);
  const copyableText = buildCopyableShareText(dateStr, solveTime, hintsUsed);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    setPlacement(null);

    if (!playerRowId) {
      setPlacementLoading(false);
      return;
    }

    setPlacementLoading(true);
    void (async () => {
      const entries = await fetchLeaderboardEntries(puzzleId);
      if (cancelled) return;
      const sliced = sliceAroundPlayer(entries, playerRowId);
      if (sliced && sliced.slice.length > 0) {
        setPlacement(sliced);
      } else {
        setPlacement(null);
      }
      setPlacementLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, puzzleId, playerRowId]);

  const performCopy = () => {
    const text = copyableText;

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard
        .writeText(text)
        .then(() => {
          setCopied(true);
          toast.success("Copied! Paste to share with friends.");
          setTimeout(() => setCopied(false), 2000);
        })
        .catch(() => {
          toast.error("Couldn't copy. Try again or use Share.");
        });
      return;
    }

    toast.error("Copy isn't available in this browser. Try Share.");
  };

  const handleCopy = () => {
    posthog.capture("copy_clicked");
    performCopy();
  };

  const handleShare = () => {
    posthog.capture("share_clicked");
    const text = copyableText;
    if (navigator.share && navigator.canShare && navigator.canShare({ text })) {
      navigator
        .share({
          title: "Decryptions Puzzle",
          text,
        })
        .then(() => {
          toast.success("Thanks for sharing!");
        })
        .catch((err) => {
          if (err instanceof Error && err.name !== "AbortError") {
            console.log("Error sharing:", err);
            performCopy();
          }
        });
    } else {
      performCopy();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>🎉 Puzzle Solved!</DialogTitle>
          <DialogDescription>
            Share your results with friends and challenge them to beat your time!
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="bg-accent p-4 rounded-lg space-y-2">
            <p className="text-center">
              <span className="text-2xl">⏱️</span>
            </p>
            <p className="text-center">
              You solved it in <span className="text-primary">{formatTime(solveTime)}</span>
            </p>
            <p className="text-center text-sm text-muted-foreground">
              Using {hintsUsed} hint{hintsUsed !== 1 ? "s" : ""}
            </p>
          </div>

          {placementLoading && (
            <p className="text-center text-sm text-muted-foreground">Loading leaderboard…</p>
          )}

          {!placementLoading && placement && (
            <LeaderboardPlacementPreview
              rank={placement.rank}
              slice={placement.slice}
              highlightIndex={placement.highlightIndex}
              className="mb-0 w-full max-w-none"
            />
          )}

          {!placementLoading && !placement && playerRowId && (
            <p className="text-center text-sm text-muted-foreground">
              Leaderboard placement will appear here once your score syncs.
            </p>
          )}

          {!placementLoading && !placement && !playerRowId && (
            <p className="text-center text-sm text-muted-foreground">
              Submit your time on the leaderboard to see how you rank.
            </p>
          )}

          <div className="flex flex-col gap-3">
            {onLeaderboard && (
              <button
                type="button"
                className={cn(
                  "inline-flex w-full min-h-[52px] items-center justify-center gap-2 rounded-md px-4 py-2",
                  "text-base font-bold text-white shadow-lg transition-[filter,box-shadow]",
                  "ring-2 ring-amber-400/90 ring-offset-2 ring-offset-background",
                  "hover:brightness-110 hover:shadow-xl",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2",
                  "[&_svg]:pointer-events-auto [&_svg]:shrink-0",
                )}
                style={{
                  background:
                    "linear-gradient(to right, rgb(245 158 11), rgb(249 115 22), rgb(225 29 72))",
                  color: "#ffffff",
                }}
                onClick={() => {
                  onOpenChange(false);
                  onLeaderboard();
                }}
              >
                <Trophy className="h-6 w-6 shrink-0" aria-hidden />
                View leaderboard and results
              </button>
            )}
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                onClick={handleShare}
                className="flex-1 gap-2 bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600"
              >
                <Share2 className="w-4 h-4" />
                Share Result
              </Button>
              <Button onClick={handleCopy} variant="outline" className="gap-2 sm:min-w-[100px]">
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-green-600" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
