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
export function clearLocalProgress() {
  try {
    Object.keys(localStorage).filter(k => k.startsWith('decryptions_') && k !== 'decryptions_account_used')
      .forEach(k => localStorage.removeItem(k));
  } catch { /* optional cache */ }
}
