function formatSolveTime(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function buildShareText(dateStr: string, solveTime: number, hintsUsed: number, verified = true): string {
  return `🔐 Decryptions — ${dateStr}

⏱️ My time: ${formatSolveTime(solveTime)}
💡 ${hintsUsed} hint${hintsUsed !== 1 ? "s" : ""} used

https://decryptions1.vercel.app/${verified ? "" : "\nUnverified legacy score"}`;
}

export async function copyShareText(text: string): Promise<void> {
  if (!navigator.clipboard || !window.isSecureContext) throw new Error("Clipboard unavailable");
  await navigator.clipboard.writeText(text);
}

