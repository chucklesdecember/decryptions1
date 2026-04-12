import { supabase } from "./supabase";

export interface SolveEntry {
  id: string;
  display_name: string;
  time_seconds: number;
  created_at: string;
  hints_used: number | null;
}

export async function fetchLeaderboardEntries(puzzleId: string): Promise<SolveEntry[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("solves")
    .select("id, display_name, time_seconds, created_at, hints_used")
    .eq("puzzle_id", puzzleId)
    .order("time_seconds", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(100);

  if (error) {
    console.error("Leaderboard fetch error:", error);
    return [];
  }
  return (data ?? []) as SolveEntry[];
}

export async function submitLeaderboardScore(params: {
  puzzleId: string;
  displayName: string;
  timeSeconds: number;
  hintsUsed: number;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!supabase) {
    return { ok: false, error: "no_supabase" };
  }
  const hintCount = Math.max(0, Math.min(99, Math.floor(params.hintsUsed)));
  const { data, error } = await supabase
    .from("solves")
    .insert({
      puzzle_id: params.puzzleId,
      display_name: params.displayName.trim(),
      time_seconds: params.timeSeconds,
      hints_used: hintCount,
    })
    .select("id")
    .single();

  if (error) {
    console.error("SUPABASE INSERT ERROR:", error);
    return { ok: false, error: error.message };
  }
  const id = data?.id;
  if (!id) return { ok: false, error: "no_id" };
  return { ok: true, id };
}

/** 0-based index of `rowId` in ordered `entries`; rank = index + 1. */
export function findRank(entries: SolveEntry[], rowId: string): number {
  const idx = entries.findIndex((e) => e.id === rowId);
  return idx === -1 ? -1 : idx + 1;
}

/** Up to 5 rows: two above, player, two below when possible. */
export function sliceAroundPlayer(entries: SolveEntry[], rowId: string): {
  rank: number;
  slice: SolveEntry[];
  highlightIndex: number;
} | null {
  const idx = entries.findIndex((e) => e.id === rowId);
  if (idx === -1) return null;
  const rank = idx + 1;
  const start = Math.max(0, idx - 2);
  const end = Math.min(entries.length, idx + 3);
  const slice = entries.slice(start, end);
  const highlightIndex = idx - start;
  return { rank, slice, highlightIndex };
}
