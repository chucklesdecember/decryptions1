import { useState } from 'react';
import { LockKeyhole } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { formatPuzzleDate, type PuzzleSummary } from '../lib/gameApi';
import { Button } from './ui/button';
import { AccountMenu } from './AccountMenu';
import { Leaderboard } from './Leaderboard';

export function ArchiveList({ puzzles, onBack, onPlay }: {
  puzzles: PuzzleSummary[]; onBack: () => void; onPlay: (puzzle: PuzzleSummary) => void;
}) {
  const { progress, status, isGuest } = useAuth();
  const [preview, setPreview] = useState<PuzzleSummary | null>(null);
  const locked = status !== 'signed_in' || isGuest;
  return <div className="min-h-app bg-orange-50">
    <header className="border-b bg-white px-4 py-3"><div className="mx-auto flex max-w-3xl items-center gap-3">
      <Button variant="outline" onClick={() => preview ? setPreview(null) : onBack()}>Back</Button>
      <h1 className="flex-1 text-lg font-semibold">Archive</h1><AccountMenu />
    </div></header>
    <main className="mx-auto max-w-3xl space-y-3 px-4 py-6">
      {locked && <section className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-2xl border bg-white p-8 text-center shadow-sm">
        <div className="rounded-full bg-amber-100 p-3"><LockKeyhole className="h-7 w-7" aria-hidden /></div>
        <div>
          <h2 className="text-xl font-semibold">Unlock the archive</h2>
          <p className="mt-2 text-sm text-muted-foreground">Create a free account or log in to play past puzzles.</p>
        </div>
        <AccountMenu prominent className="h-11 w-full max-w-xs justify-center rounded-full bg-black px-6 text-base text-white hover:bg-gray-800" />
      </section>}
      {!locked && <>
      {!puzzles.length && <p>No past puzzles are available yet.</p>}
      {preview ? <>
        <h2 className="text-lg font-semibold">{formatPuzzleDate(preview.date)}</h2><p>{preview.category}</p>
        <p>Time starts when you open the clues. You can pause at any time.</p>
        <Button onClick={() => onPlay(preview)}>{progress.some(p => p.puzzleId === preview.id) ? 'View solved puzzle' : 'Play puzzle'}</Button>
        <Leaderboard puzzleId={preview.id} myRowId={progress.find(p => p.puzzleId === preview.id)?.rowId} />
      </> : puzzles.map(p => <button key={p.id} onClick={() => setPreview(p)}
        className="block w-full rounded-xl border bg-white p-4 text-left hover:border-primary">
        <p>{formatPuzzleDate(p.date)}</p><p className="text-sm text-muted-foreground">{p.category}</p>
        {progress.some(row => row.puzzleId === p.id) && <p className="text-sm text-green-700">Solved</p>}
      </button>)}
      </>}
    </main>
  </div>;
}
