import { Lightbulb } from "lucide-react";
import { cn } from "./ui/utils";
import type { SolveEntry } from "../lib/leaderboardApi";

interface LeaderboardPlacementPreviewProps {
  rank: number;
  slice: SolveEntry[];
  highlightIndex: number;
  className?: string;
}

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function LeaderboardPlacementPreview({
  rank,
  slice,
  highlightIndex,
  className,
}: LeaderboardPlacementPreviewProps) {
  if (slice.length === 0) return null;

  const startRank = rank - highlightIndex;

  return (
    <div
      className={cn(
        "mx-auto mb-4 max-w-md rounded-xl border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50/80 p-4 shadow-md",
        className,
      )}
    >
      <p className="mb-3 text-center text-sm font-semibold text-orange-900">
        You placed on the leaderboard
      </p>
      <div className="space-y-1.5">
        {slice.map((entry, i) => {
          const rowRank = startRank + i;
          const isYou = i === highlightIndex;
          const nHints = entry.hints_used ?? 0;
          return (
            <div
              key={entry.id}
              className={
                isYou
                  ? "flex items-center justify-between gap-2 rounded-lg border-2 border-orange-500 bg-white px-3 py-2 shadow-sm"
                  : "flex items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white/80 px-3 py-1.5"
              }
            >
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span className="w-7 shrink-0 tabular-nums text-xs font-semibold text-gray-700">
                  {rowRank}.
                </span>
                <span
                  className={
                    isYou
                      ? "truncate text-sm font-bold text-orange-950"
                      : "truncate text-sm font-medium text-gray-800"
                  }
                >
                  {entry.display_name}
                  {isYou && (
                    <span className="ml-1.5 text-xs font-normal text-orange-700">(you)</span>
                  )}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {nHints > 0 && (
                  <span
                    className="inline-flex items-center gap-0.5"
                    aria-label={`${nHints} hint${nHints !== 1 ? "s" : ""}`}
                  >
                    {Array.from({ length: nHints }).map((_, hi) => (
                      <Lightbulb
                        key={`${entry.id}-p-${hi}`}
                        className="size-3 shrink-0 text-amber-500"
                        aria-hidden
                      />
                    ))}
                  </span>
                )}
                <span className="tabular-nums text-sm font-semibold text-gray-900">
                  {formatTime(entry.time_seconds)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
