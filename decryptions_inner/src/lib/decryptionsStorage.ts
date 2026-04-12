/** localStorage key for saved display username */
export const USERNAME_KEY = "decryptions_username";

export function getStoredUsername(): string | null {
  try {
    const v = localStorage.getItem(USERNAME_KEY);
    if (!v) return null;
    const t = v.trim();
    return t.length > 0 ? t : null;
  } catch {
    return null;
  }
}

export function setStoredUsername(username: string): void {
  try {
    localStorage.setItem(USERNAME_KEY, username.trim());
  } catch {
    // ignore
  }
}

export function puzzleSolvedKey(puzzleId: string): string {
  return `decryptions_solved_${puzzleId}`;
}

export function puzzleSolveSecondsKey(puzzleId: string): string {
  return `decryptions_solve_seconds_${puzzleId}`;
}

export function puzzleSolveHintsKey(puzzleId: string): string {
  return `decryptions_solve_hints_${puzzleId}`;
}

export function isPuzzleSolvedLocally(puzzleId: string): boolean {
  try {
    return localStorage.getItem(puzzleSolvedKey(puzzleId)) === "1";
  } catch {
    return false;
  }
}

export function getStoredSolveSeconds(puzzleId: string): number | null {
  try {
    const raw = localStorage.getItem(puzzleSolveSecondsKey(puzzleId));
    if (raw == null) return null;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : null;
  } catch {
    return null;
  }
}

export function getStoredSolveHints(puzzleId: string): number | null {
  try {
    const raw = localStorage.getItem(puzzleSolveHintsKey(puzzleId));
    if (raw == null) return null;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : null;
  } catch {
    return null;
  }
}

export function markPuzzleSolvedLocally(
  puzzleId: string,
  timeSeconds: number,
  hintsUsed: number,
): void {
  try {
    localStorage.setItem(puzzleSolvedKey(puzzleId), "1");
    localStorage.setItem(puzzleSolveSecondsKey(puzzleId), String(Math.max(0, Math.floor(timeSeconds))));
    localStorage.setItem(puzzleSolveHintsKey(puzzleId), String(Math.max(0, Math.floor(hintsUsed))));
  } catch {
    // ignore
  }
}

/** Prevents duplicate leaderboard inserts for the same puzzle on this device. */
export function leaderboardSubmittedKey(puzzleId: string): string {
  return `decryptions_lb_submitted_${puzzleId}`;
}

export function hasLeaderboardSubmittedLocally(puzzleId: string): boolean {
  try {
    return localStorage.getItem(leaderboardSubmittedKey(puzzleId)) === "1";
  } catch {
    return false;
  }
}

export function markLeaderboardSubmittedLocally(puzzleId: string): void {
  try {
    localStorage.setItem(leaderboardSubmittedKey(puzzleId), "1");
  } catch {
    // ignore
  }
}

export function leaderboardRowIdKey(puzzleId: string): string {
  return `decryptions_lb_row_id_${puzzleId}`;
}

export function getStoredLeaderboardRowId(puzzleId: string): string | null {
  try {
    const v = localStorage.getItem(leaderboardRowIdKey(puzzleId));
    return v && v.length > 0 ? v : null;
  } catch {
    return null;
  }
}

export function setStoredLeaderboardRowId(puzzleId: string, rowId: string): void {
  try {
    localStorage.setItem(leaderboardRowIdKey(puzzleId), rowId);
  } catch {
    // ignore
  }
}
