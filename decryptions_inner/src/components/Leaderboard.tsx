import { useEffect, useState } from "react";
import { Lightbulb, LogIn } from "lucide-react";
import posthog from "posthog-js";
import { supabase } from "../lib/supabase";
import { fetchLeaderboardEntries, type SolveEntry } from "../lib/leaderboardApi";
import { ensureLeaderboardPosted } from "../lib/progressSync";
import {
  getStoredLeaderboardRowId,
  hasLeaderboardSubmittedLocally,
} from "../lib/decryptionsStorage";
import { useAuth } from "../lib/auth";
import { Button } from "./ui/button";

interface LeaderboardProps {
  puzzleId: string;
  solveTime: number;
  isSolved: boolean;
  hintsUsed: number;
  /** Called after a successful post from this view (row id for preview sync). */
  onSubmitted?: (rowId: string) => void;
}

export function Leaderboard({ puzzleId, solveTime, isSolved, hintsUsed, onSubmitted }: LeaderboardProps) {
  const { status, user, profile, requireAuth, progressVersion, bumpProgress } = useAuth();
  const [entries, setEntries] = useState<SolveEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const myRowId = getStoredLeaderboardRowId(puzzleId);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const loadLeaderboard = async () => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const rows = await fetchLeaderboardEntries(puzzleId);
    setEntries(rows);
    setIsLoading(false);
  };

  // Reload when the puzzle changes or synced progress lands (e.g. auto-post after solve).
  useEffect(() => {
    setHasSubmitted(hasLeaderboardSubmittedLocally(puzzleId));
    setError(null);
    void loadLeaderboard();
  }, [puzzleId, progressVersion]);

  /** Retry path: signed-in players are normally posted automatically when they solve. */
  const handlePost = async () => {
    if (!supabase || !user || isSubmitting || !isSolved || hasSubmitted) return;
    setIsSubmitting(true);
    setError(null);
    const { rowId, posted } = await ensureLeaderboardPosted({
      userId: user.id,
      username: profile?.username ?? "",
      puzzleId,
      timeSeconds: solveTime,
      hintsUsed,
    });
    setIsSubmitting(false);
    if (!rowId) {
      setError("Could not post your time. Try again in a moment.");
      return;
    }
    if (posted) posthog.capture("leaderboard_submitted", { puzzle_id: puzzleId });
    setHasSubmitted(true);
    onSubmitted?.(rowId);
    bumpProgress();
  };

  const showPostBox = !!supabase && isSolved && !hasSubmitted;

  return (
    <section className="rounded-xl border border-gray-300 bg-white p-4 text-gray-900 shadow-md sm:p-5 mb-4">
      <div className="mb-4">
        <h3 className="mb-1 text-xl font-semibold text-black">Leaderboard</h3>
        <p className="text-sm font-medium text-gray-600">Fastest times for this puzzle</p>
      </div>

      {!supabase && (
        <p className="text-sm font-medium text-gray-700">
          Leaderboard is unavailable. Add Supabase env vars to enable it.
        </p>
      )}

      {showPostBox && status === "signed_out" && (
        <div className="mb-6 rounded-lg border-2 border-gray-200 bg-gray-50 p-4 sm:p-5">
          <h4 className="mb-1 text-lg font-semibold text-black">Post your time</h4>
          <p className="mb-4 text-sm text-gray-700">
            Log in to put your {formatTime(solveTime)} on the leaderboard under your username.
          </p>
          <Button
            type="button"
            onClick={() => requireAuth()}
            className="h-11 gap-2 bg-black px-5 text-base font-semibold text-white hover:bg-gray-800"
          >
            <LogIn className="h-4 w-4" />
            Log in or sign up
          </Button>
        </div>
      )}

      {showPostBox && status === "signed_in" && (
        <div className="mb-6 rounded-lg border-2 border-gray-200 bg-gray-50 p-4 sm:p-5">
          <h4 className="mb-1 text-lg font-semibold text-black">Post your time</h4>
          <p className="mb-4 text-sm text-gray-700">
            Your {formatTime(solveTime)} isn't on the leaderboard yet. It will appear as{" "}
            <span className="font-semibold text-black">{profile?.username ?? "your username"}</span>.
          </p>
          <button
            type="button"
            onClick={() => void handlePost()}
            disabled={isSubmitting}
            style={{
              backgroundColor: "black",
              color: "white",
              border: "2px solid black",
              padding: "12px 20px",
              fontSize: "16px",
              fontWeight: "600",
              borderRadius: "8px",
              cursor: isSubmitting ? "not-allowed" : "pointer",
              opacity: isSubmitting ? 0.6 : 1,
            }}
          >
            {isSubmitting ? "Posting..." : "Post my time"}
          </button>
        </div>
      )}

      {supabase && isSolved && hasSubmitted && (
        <p className="mb-3 text-sm font-medium text-green-800">
          Score submitted: {formatTime(solveTime)}
        </p>
      )}

      {error && <p className="mb-3 text-sm font-medium text-red-700">{error}</p>}

      {isLoading ? (
        <p className="text-sm font-medium text-gray-700">Loading leaderboard...</p>
      ) : entries.length === 0 ? (
        <p className="text-sm font-medium text-gray-700">No solves yet. Be the first!</p>
      ) : (
        <div className="space-y-2">
          {entries.map((entry, index) => {
            const nHints = entry.hints_used ?? 0;
            const isMe = myRowId != null && entry.id === myRowId;
            return (
              <div
                key={entry.id}
                className={
                  isMe
                    ? "flex items-center justify-between gap-3 rounded-lg border-2 border-orange-400 bg-orange-50 px-3 py-2.5"
                    : "flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5"
                }
              >
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="w-7 shrink-0 tabular-nums text-xs font-semibold text-gray-600">{index + 1}.</span>
                  <span className="truncate text-sm font-medium text-black">{entry.display_name}</span>
                  {isMe && <span className="shrink-0 text-xs text-orange-700">(you)</span>}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {nHints > 0 && (
                    <span
                      className="inline-flex items-center gap-0.5"
                      aria-label={`${nHints} hint${nHints !== 1 ? "s" : ""} used`}
                      title={`${nHints} hint${nHints !== 1 ? "s" : ""} used`}
                    >
                      {Array.from({ length: nHints }).map((_, i) => (
                        <Lightbulb
                          key={`${entry.id}-h-${i}`}
                          className="size-3.5 shrink-0 text-amber-500"
                          aria-hidden
                        />
                      ))}
                    </span>
                  )}
                  <span className="tabular-nums text-sm font-semibold text-black">{formatTime(entry.time_seconds)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
