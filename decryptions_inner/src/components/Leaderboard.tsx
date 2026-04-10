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
    <section className="bg-white rounded-xl shadow-md p-4 border border-border mb-4">
      <div className="mb-3">
        <h3 className="text-primary">Leaderboard</h3>
        <p className="text-xs text-muted-foreground">Fastest times for this puzzle</p>
      </div>

      {!supabase && (
        <p className="text-sm text-muted-foreground">
          Leaderboard is unavailable. Add Supabase env vars to enable it.
        </p>
      )}

      {supabase && isSolved && !hasSubmitted && (
        <form
          onSubmit={handleSubmit}
          className="mb-6 rounded-xl border-2 border-amber-200 bg-gradient-to-b from-amber-50 to-orange-50/80 p-4 sm:p-5 shadow-sm"
        >
          <h4 className="text-lg font-semibold text-foreground mb-1">Join the leaderboard</h4>
          <p className="text-sm text-muted-foreground mb-4">
            Enter a username to join the leaderboard. It will appear next to your time.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your username"
              maxLength={40}
              disabled={isSubmitting}
              className="h-12 text-base sm:flex-1 border-2 border-amber-200/80 bg-white focus-visible:ring-amber-500"
              autoComplete="username"
            />
            <Button
              type="submit"
              size="lg"
              disabled={isSubmitting}
              className="h-12 min-w-[140px] shrink-0 px-6 text-base font-semibold bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 shadow-sm"
            >
              {isSubmitting ? "Submitting..." : "Submit score"}
            </Button>
          </div>
        </form>
      )}

      {supabase && isSolved && hasSubmitted && (
        <p className="text-sm text-green-700 mb-3">
          Score submitted: {formatTime(solveTime)}
        </p>
      )}

      {error && <p className="text-sm text-red-700 mb-3">{error}</p>}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading leaderboard...</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">No solves yet. Be the first!</p>
      ) : (
        <div className="space-y-2">
          {entries.map((entry, index) => (
            <div
              key={entry.id}
              className="flex items-center justify-between bg-accent rounded-lg px-3 py-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs text-muted-foreground w-6">{index + 1}.</span>
                <span className="text-sm truncate">{entry.display_name}</span>
              </div>
              <span className="text-sm tabular-nums">{formatTime(entry.time_seconds)}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
