import { supabase } from "./supabase";
import { claimSolves } from "./authApi";
import {
  fetchOwnSolveRowId,
  submitLeaderboardScore,
} from "./leaderboardApi";
import {
  getAllStoredLeaderboardRowIds,
  getLocallySolvedPuzzleIds,
  getStoredLeaderboardRowId,
  getStoredSolveHints,
  getStoredSolveSeconds,
  hasLeaderboardSubmittedLocally,
  markLeaderboardSubmittedLocally,
  markPuzzleSolvedLocally,
  setStoredLeaderboardRowId,
} from "./decryptionsStorage";

/** Row in `public.progress`. */
export interface ProgressRow {
  user_id: string;
  puzzle_id: string;
  time_seconds: number;
  hints_used: number;
  solved_at: string;
  leaderboard_row_id: string | null;
}

export async function fetchCloudProgress(userId: string): Promise<ProgressRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("progress")
    .select("user_id, puzzle_id, time_seconds, hints_used, solved_at, leaderboard_row_id")
    .eq("user_id", userId);
  if (error) {
    console.error("progress fetch error:", error);
    return [];
  }
  return (data ?? []) as ProgressRow[];
}

/** Insert or update the player's cloud record for one puzzle. */
export async function upsertProgress(params: {
  userId: string;
  puzzleId: string;
  timeSeconds: number;
  hintsUsed: number;
  leaderboardRowId?: string | null;
}): Promise<boolean> {
  if (!supabase) return false;
  const row: Record<string, unknown> = {
    user_id: params.userId,
    puzzle_id: params.puzzleId,
    time_seconds: Math.max(0, Math.floor(params.timeSeconds)),
    hints_used: Math.max(0, Math.floor(params.hintsUsed)),
  };
  if (params.leaderboardRowId !== undefined) row.leaderboard_row_id = params.leaderboardRowId;
  const { error } = await supabase
    .from("progress")
    .upsert(row, { onConflict: "user_id,puzzle_id" });
  if (error) {
    console.error("progress upsert error:", error);
    return false;
  }
  return true;
}

/** Mirror cloud rows into localStorage (cloud wins over any local value). */
export function applyCloudProgressLocally(rows: ProgressRow[]): void {
  for (const row of rows) {
    markPuzzleSolvedLocally(row.puzzle_id, row.time_seconds, row.hints_used ?? 0);
    if (row.leaderboard_row_id) {
      markLeaderboardSubmittedLocally(row.puzzle_id);
      setStoredLeaderboardRowId(row.puzzle_id, row.leaderboard_row_id);
    }
  }
}

/**
 * Make sure the player's time for a puzzle is on the leaderboard and remembered locally.
 * Handles the "already posted from another device" case by looking up the existing row.
 * Returns the leaderboard row id, or null if it could not be posted right now.
 */
export async function ensureLeaderboardPosted(params: {
  userId: string;
  username: string;
  puzzleId: string;
  timeSeconds: number;
  hintsUsed: number;
}): Promise<{ rowId: string | null; posted: boolean }> {
  const { userId, username, puzzleId, timeSeconds, hintsUsed } = params;
  if (!supabase) return { rowId: null, posted: false };

  if (hasLeaderboardSubmittedLocally(puzzleId)) {
    return { rowId: getStoredLeaderboardRowId(puzzleId), posted: false };
  }

  const res = await submitLeaderboardScore({
    puzzleId,
    userId,
    displayName: username,
    timeSeconds,
    hintsUsed,
  });

  let rowId: string | null = null;
  let posted = false;
  if (res.ok) {
    rowId = res.id;
    posted = true;
  } else if (res.error === "duplicate") {
    rowId = await fetchOwnSolveRowId(puzzleId, userId);
  }

  if (rowId) {
    markLeaderboardSubmittedLocally(puzzleId);
    setStoredLeaderboardRowId(puzzleId, rowId);
    await upsertProgress({ userId, puzzleId, timeSeconds, hintsUsed, leaderboardRowId: rowId });
  }
  return { rowId, posted };
}

export interface SyncSummary {
  pulled: number;
  pushed: number;
  claimed: number;
  posted: number;
}

/**
 * Run once per sign-in:
 *  1. pull cloud progress into localStorage,
 *  2. push puzzles solved on this device that the account does not know about,
 *  3. (when allowed) attach this device's pre-account leaderboard rows to the account,
 *  4. post any solved puzzle that never made it onto the leaderboard.
 */
export async function syncAfterSignIn(params: {
  userId: string;
  username: string;
  /** Legacy leaderboard rows are only claimed on sign-up, or when the device's old name matches. */
  allowClaimLegacyRows: boolean;
}): Promise<SyncSummary> {
  const { userId, username, allowClaimLegacyRows } = params;
  const summary: SyncSummary = { pulled: 0, pushed: 0, claimed: 0, posted: 0 };
  if (!supabase) return summary;

  // Snapshot local state before the pull overwrites it.
  const localIds = getLocallySolvedPuzzleIds();
  const localRowIds = getAllStoredLeaderboardRowIds();

  const cloudRows = await fetchCloudProgress(userId);
  const cloudIds = new Set(cloudRows.map((r) => r.puzzle_id));
  applyCloudProgressLocally(cloudRows);
  summary.pulled = cloudRows.length;

  // Push local-only solves.
  for (const puzzleId of localIds) {
    if (cloudIds.has(puzzleId)) continue;
    const ok = await upsertProgress({
      userId,
      puzzleId,
      timeSeconds: getStoredSolveSeconds(puzzleId) ?? 0,
      hintsUsed: getStoredSolveHints(puzzleId) ?? 0,
      leaderboardRowId: getStoredLeaderboardRowId(puzzleId),
    });
    if (ok) summary.pushed += 1;
  }

  // Claim legacy anonymous leaderboard rows this device inserted.
  if (allowClaimLegacyRows && localRowIds.length > 0) {
    summary.claimed = await claimSolves(localRowIds.map((r) => r.rowId));
  }

  // Post anything solved but never put on the leaderboard.
  for (const puzzleId of getLocallySolvedPuzzleIds()) {
    if (hasLeaderboardSubmittedLocally(puzzleId)) continue;
    const seconds = getStoredSolveSeconds(puzzleId);
    if (seconds == null) continue;
    const { posted } = await ensureLeaderboardPosted({
      userId,
      username,
      puzzleId,
      timeSeconds: seconds,
      hintsUsed: getStoredSolveHints(puzzleId) ?? 0,
    });
    if (posted) summary.posted += 1;
  }

  return summary;
}
