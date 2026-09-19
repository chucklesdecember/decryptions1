/** Legacy (pre-accounts) display username. Only used to prefill sign-up and to let this device claim its old leaderboard rows. */
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

// ---------------------------------------------------------------------------
// Account sync helpers. localStorage stays the read cache for solved state; the
// `progress` table is the source of truth for signed-in players.
// ---------------------------------------------------------------------------

const SOLVED_PREFIX = "decryptions_solved_";
const LB_ROW_ID_PREFIX = "decryptions_lb_row_id_";
const APP_KEY_PREFIX = "decryptions_";
/** Set once any account has logged in on this device; makes the auth dialog default to "Log in". */
const HAS_ACCOUNT_KEY = "decryptions_has_account";
/** Keys that survive `clearLocalProgress` (device hints, not player data). */
const KEEP_ON_CLEAR = new Set([HAS_ACCOUNT_KEY]);

export function hasAccountBeenUsedOnDevice(): boolean {
  try {
    return localStorage.getItem(HAS_ACCOUNT_KEY) === "1";
  } catch {
    return false;
  }
}

export function markAccountUsedOnDevice(): void {
  try {
    localStorage.setItem(HAS_ACCOUNT_KEY, "1");
  } catch {
    // ignore
  }
}

/** Puzzle ids marked solved on this device. */
export function getLocallySolvedPuzzleIds(): string[] {
  const ids: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(SOLVED_PREFIX) && localStorage.getItem(key) === "1") {
        ids.push(key.slice(SOLVED_PREFIX.length));
      }
    }
  } catch {
    // ignore
  }
  return ids;
}

/** Leaderboard row ids this device inserted, keyed by puzzle id. */
export function getAllStoredLeaderboardRowIds(): { puzzleId: string; rowId: string }[] {
  const out: { puzzleId: string; rowId: string }[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(LB_ROW_ID_PREFIX)) continue;
      const rowId = localStorage.getItem(key);
      if (rowId) out.push({ puzzleId: key.slice(LB_ROW_ID_PREFIX.length), rowId });
    }
  } catch {
    // ignore
  }
  return out;
}

/**
 * Remove every Decryptions key (solved flags, times, hints, leaderboard markers, legacy
 * username). Used on sign-out so the next account on this device starts clean; the
 * signed-out account's data lives in the `progress` table.
 */
export function clearLocalProgress(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(APP_KEY_PREFIX) && !KEEP_ON_CLEAR.has(key)) keys.push(key);
    }
    keys.forEach((key) => localStorage.removeItem(key));
  } catch {
    // ignore
  }
}
