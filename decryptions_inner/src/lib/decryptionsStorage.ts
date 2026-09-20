// Legacy names may prefill sign-up, but never prove score ownership.
export function getStoredUsername(): string | null {
  try { return localStorage.getItem('decryptions_username')?.trim() || null; } catch { return null; }
}
export function hasAccountBeenUsedOnDevice(): boolean {
  try { return localStorage.getItem('decryptions_account_used') === '1'; } catch { return false; }
}
export function markAccountUsedOnDevice() {
  try { localStorage.setItem('decryptions_account_used', '1'); } catch { /* optional preference */ }
}
export function rememberPuzzleForEmailConfirmation(puzzleId = 'daily') {
  try { localStorage.setItem('decryptions_auth_return_puzzle', puzzleId); } catch { /* optional navigation aid */ }
}
export function takePuzzleForEmailConfirmation(): string | null {
  try {
    const value = localStorage.getItem('decryptions_auth_return_puzzle');
    if (value) localStorage.removeItem('decryptions_auth_return_puzzle');
    return value;
  } catch { return null; }
}
export function clearLocalProgress() {
  try {
    Object.keys(localStorage).filter(k => k.startsWith('decryptions_') &&
      k !== 'decryptions_account_used' && k !== 'decryptions_auth_return_puzzle')
      .forEach(k => localStorage.removeItem(k));
  } catch { /* optional cache */ }
}
