import { supabase } from "./supabase";
import { getStoredUsername } from "./decryptionsStorage";

export interface SolveEntry {
  id: string;
  display_name: string;
  time_seconds: number;
  created_at: string;
  hints_used: number | null;
}

/**
 * True if this display name is already used on the leaderboard by someone else.
 * The same device may reuse its stored username across puzzles.
 */
export async function isDisplayNameTakenByAnother(name: string): Promise<boolean> {
  if (!supabase) return false;
  const t = name.trim().toLowerCase();
  if (!t) return false;
  const stored = getStoredUsername()?.trim().toLowerCase() ?? "";
  if (stored && stored === t) return false;

  const { data, error } = await supabase.from("solves").select("display_name").limit(5000);
  if (error || !data) return false;
  return data.some((row) => row.display_name.trim().toLowerCase() === t);
}

/** Rank: fastest time first; tie → fewer hints; tie → earlier submit (created_at). */
function compareLeaderboardEntries(a: SolveEntry, b: SolveEntry): number {
  if (a.time_seconds !== b.time_seconds) return a.time_seconds - b.time_seconds;
  const ha = a.hints_used ?? 0;
  const hb = b.hints_used ?? 0;
  if (ha !== hb) return ha - hb;
  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
}

export async function fetchLeaderboardEntries(puzzleId: string): Promise<SolveEntry[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("solves")
    .select("id, display_name, time_seconds, created_at, hints_used")
    .eq("puzzle_id", puzzleId)
    .limit(5000);

  if (error) {
    console.error("Leaderboard fetch error:", error);
    return [];
  }
  const rows = (data ?? []) as SolveEntry[];
  rows.sort(compareLeaderboardEntries);
  return rows.slice(0, 100);
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
    const code = (error as { code?: string }).code;
    if (code === "23505") {
      return { ok: false, error: "duplicate" };
    }
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
