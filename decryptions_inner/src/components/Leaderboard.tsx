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

      {supabase && isSolved && !hasSubmitted && (
        <form
          onSubmit={handleSubmit}
          className="mb-6 rounded-lg border-2 border-gray-200 bg-gray-50 p-4 sm:p-5"
        >
          <h4 className="mb-1 text-lg font-semibold text-black">Join the leaderboard</h4>
          <p className="mb-4 text-sm text-gray-700">
            Enter a username to join the leaderboard. It will appear next to your time.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your username"
              maxLength={40}
              disabled={isSubmitting}
              className="h-12 border-2 border-gray-300 bg-white text-base text-black placeholder:text-gray-500 focus-visible:border-gray-900 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 sm:flex-1"
              autoComplete="username"
            />
            <Button
              type="submit"
              size="lg"
              disabled={isSubmitting}
              className="h-12 min-w-[140px] shrink-0 bg-black px-6 text-base font-semibold text-white shadow-sm hover:bg-gray-900 disabled:opacity-50"
            >
              {isSubmitting ? "Submitting..." : "Submit score"}
            </Button>
          </div>
        </form>
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
          {entries.map((entry, index) => (
            <div
              key={entry.id}
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="w-6 tabular-nums text-xs font-semibold text-gray-600">{index + 1}.</span>
                <span className="truncate text-sm font-medium text-black">{entry.display_name}</span>
              </div>
              <span className="tabular-nums text-sm font-semibold text-black">{formatTime(entry.time_seconds)}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
