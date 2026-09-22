import { fetchProgress, type ProgressRow } from './gameApi';
// This cache is never used to authorize a solve and is never uploaded.
export const syncAfterSignIn = () => fetchProgress();
export function cacheProgress(userId: string, rows: ProgressRow[]) {
  try { localStorage.setItem(`decryptions_account_progress_v2_${userId}`, JSON.stringify(rows)); }
  catch { /* Optional cache; the server remains authoritative. */ }
}
