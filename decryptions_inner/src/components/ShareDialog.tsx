import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Share2, Check, ExternalLink } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import posthog from "posthog-js";
import {
  fetchLeaderboardEntries,
  sliceAroundPlayer,
  type SolveEntry,
} from "../lib/leaderboardApi";
import { LeaderboardPlacementPreview } from "./LeaderboardPlacementPreview";
import { buildShareText, copyShareText } from "../lib/shareResult";
import { NextPuzzleCountdown } from "./NextPuzzleCountdown";

interface ShareDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  solveTime: number;
  verified: boolean;
  hintsUsed: number;
  /** Daily puzzle date label, e.g. "April 14, 2026" */
  puzzleDate: string;
  puzzleId: string;
  /** When set, shown as the right-hand action instead of Copy. */
  articleUrl?: string;
  /** Server-confirmed leaderboard row; used to slice the leaderboard */
  playerRowId: string | null;
  isGuest?: boolean;
  onRequireAccount?: () => void;
  onStats?: () => void;
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

export function ShareDialog({
  isOpen,
  onOpenChange,
  solveTime,
  verified,
  hintsUsed,
  puzzleDate,
  puzzleId,
  articleUrl,
  playerRowId,
  isGuest = false,
  onRequireAccount,
  onStats,
}: ShareDialogProps) {
  const [copied, setCopied] = useState(false);
  const [placementLoading, setPlacementLoading] = useState(false);
  const [placement, setPlacement] = useState<{
    rank: number;
    slice: SolveEntry[];
    highlightIndex: number;
  } | null>(null);

  const dateStr = formatShortDate(puzzleDate);
  const copyableText = buildShareText(dateStr, solveTime, hintsUsed, verified);

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
      const entries = await fetchLeaderboardEntries(puzzleId).catch(() => []);
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
      copyShareText(text)
        .then(() => {
          setCopied(true);
          toast.success("Result copied — paste it anywhere.");
          setTimeout(() => setCopied(false), 2000);
        })
        .catch(() => {
          toast.error("Couldn't copy the result. Please try again.");
        });
      return;
    }

    toast.error("Copy isn't available in this browser.");
  };

  const handleShare = () => {
    posthog.capture("share_clicked");
    performCopy();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Puzzle solved</DialogTitle>
          <DialogDescription>
            Copy your result, then paste it wherever you want to share it.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {!verified && <p className="text-center text-sm text-amber-800">Unverified legacy score</p>}
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

          <NextPuzzleCountdown />

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
              Your score is saved. Placement is unavailable or outside the top 100.
            </p>
          )}

          {!placementLoading && !placement && !playerRowId && (
            <p className="text-center text-sm text-muted-foreground">
              This legacy completion has no leaderboard entry.
            </p>
          )}

          <div className="flex flex-col gap-3">
            <Button
              onClick={handleShare}
              className="min-h-[52px] w-full gap-2 bg-gradient-to-r from-orange-500 to-pink-500 text-base font-bold shadow-md hover:from-orange-600 hover:to-pink-600 hover:shadow-lg"
            >
              {copied ? <Check className="h-5 w-5" /> : <Share2 className="h-5 w-5" />}
              {copied ? "Copied!" : "Share"}
            </Button>
            {isGuest && <Button variant="outline" onClick={onRequireAccount}>Create account to save your play</Button>}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {!isGuest && onStats && <Button variant="outline" onClick={() => { onOpenChange(false); onStats(); }}>View your stats</Button>}
              {articleUrl && (
                <Button variant="outline" className="gap-2" asChild>
                  <a
                    href={articleUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => posthog.capture("article_link_clicked", { puzzle_id: puzzleId })}
                  >
                    <ExternalLink className="w-4 h-4" />
                    Article
                  </a>
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
