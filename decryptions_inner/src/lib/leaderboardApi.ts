import { gameRpc } from './gameApi';
export interface SolveEntry {
  id: string; display_name: string; time_seconds: number;
  created_at: string; hints_used: number | null; verified: boolean;
}
export const fetchLeaderboardEntries = (puzzleId: string) =>
  gameRpc<SolveEntry[]>('get_leaderboard', { p_puzzle_id: puzzleId });

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
