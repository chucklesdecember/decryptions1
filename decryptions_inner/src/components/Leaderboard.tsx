import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { supabase } from "../lib/supabase";
import { getStoredUsername } from "../lib/decryptionsStorage";

interface LeaderboardProps {
  puzzleId: string;
  solveTime: number;
  isSolved: boolean;
}

interface SolveEntry {
  id: string;
  display_name: string;
  time_seconds: number;
  created_at: string;
}

export function Leaderboard({ puzzleId, solveTime, isSolved }: LeaderboardProps) {
  const [entries, setEntries] = useState<SolveEntry[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    const { data, error: selectError } = await supabase
      .from("solves")
      .select("id, display_name, time_seconds, created_at")
      .eq("puzzle_id", puzzleId)
      .order("time_seconds", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(25);

    if (selectError) {
      setError("Could not load leaderboard.");
    } else {
      setEntries(data ?? []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    setHasSubmitted(false);
    setDisplayName(getStoredUsername() ?? "");
    setError(null);
    void loadLeaderboard();
  }, [puzzleId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || isSubmitting || !isSolved || hasSubmitted) return;

    const trimmed = displayName.trim();
    if (!trimmed) {
      setError("Please enter a display name.");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    const { error: insertError } = await supabase.from("solves").insert({
      puzzle_id: puzzleId,
      display_name: trimmed,
      time_seconds: solveTime,
    });

    if (insertError) {
      setError("Could not submit your score.");
      setIsSubmitting(false);
      return;
    }

    setHasSubmitted(true);
    setIsSubmitting(false);
    await loadLeaderboard();
  };

  return (
    <section className="bg-black text-white rounded-xl shadow-lg p-4 sm:p-5 border-2 border-gray-800 mb-4">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-white mb-1">Leaderboard</h3>
        <p className="text-sm text-gray-400">Fastest times for this puzzle</p>
      </div>

      {!supabase && (
        <p className="text-sm text-gray-300">
          Leaderboard is unavailable. Add Supabase env vars to enable it.
        </p>
      )}

      {supabase && isSolved && !hasSubmitted && (
        <form
          onSubmit={handleSubmit}
          className="mb-6 rounded-xl border border-gray-700 bg-zinc-950 p-4 sm:p-5"
        >
          <h4 className="text-lg font-semibold text-white mb-1">Join the leaderboard</h4>
          <p className="text-sm text-gray-400 mb-4">
            Enter a username to join the leaderboard. It will appear next to your time.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your username"
              maxLength={40}
              disabled={isSubmitting}
              className="h-12 text-base sm:flex-1 border-2 border-gray-600 bg-white text-black placeholder:text-gray-500 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
              autoComplete="username"
            />
            <Button
              type="submit"
              size="lg"
              disabled={isSubmitting}
              className="h-12 min-w-[140px] shrink-0 px-6 text-base font-semibold bg-white text-black border-2 border-gray-200 hover:bg-gray-100 shadow-sm disabled:opacity-50"
            >
              {isSubmitting ? "Submitting..." : "Submit score"}
            </Button>
          </div>
        </form>
      )}

      {supabase && isSolved && hasSubmitted && (
        <p className="text-sm text-green-400 mb-3">
          Score submitted: {formatTime(solveTime)}
        </p>
      )}

      {error && <p className="text-sm text-red-400 mb-3">{error}</p>}

      {isLoading ? (
        <p className="text-sm text-gray-400">Loading leaderboard...</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-gray-400">No solves yet. Be the first!</p>
      ) : (
        <div className="space-y-2">
          {entries.map((entry, index) => (
            <div
              key={entry.id}
              className="flex items-center justify-between rounded-lg border border-gray-800 bg-zinc-950 px-3 py-2.5 text-white"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs text-gray-500 w-6 tabular-nums">{index + 1}.</span>
                <span className="text-sm truncate text-white">{entry.display_name}</span>
              </div>
              <span className="text-sm tabular-nums text-gray-200">{formatTime(entry.time_seconds)}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
