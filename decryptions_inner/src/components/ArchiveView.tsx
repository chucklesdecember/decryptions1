import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { formatPuzzleDate, type PuzzleSummary } from '../lib/gameApi';
import { Button } from './ui/button';
import { AccountMenu } from './AccountMenu';
import { Leaderboard } from './Leaderboard';

export function ArchiveList({ puzzles, onBack, onPlay }: {
  puzzles: PuzzleSummary[]; onBack: () => void; onPlay: (puzzle: PuzzleSummary) => void;
}) {
  const { progress } = useAuth();
  const [preview, setPreview] = useState<PuzzleSummary | null>(null);
  return <div className="min-h-app bg-orange-50">
    <header className="border-b bg-white px-4 py-3"><div className="mx-auto flex max-w-3xl items-center gap-3">
      <Button variant="outline" onClick={() => preview ? setPreview(null) : onBack()}>Back</Button>
      <h1 className="flex-1 text-lg font-semibold">Archive</h1><AccountMenu />
    </div></header>
    <main className="mx-auto max-w-3xl space-y-3 px-4 py-6">
      {!puzzles.length && <p>No past puzzles are available yet.</p>}
      {preview ? <>
        <h2 className="text-lg font-semibold">{formatPuzzleDate(preview.date)}</h2><p>{preview.category}</p>
        <p>Time starts when you open the clues and keeps running until you solve.</p>
        <Button onClick={() => onPlay(preview)}>{progress.some(p => p.puzzleId === preview.id) ? 'View solved puzzle' : 'Play puzzle'}</Button>
        <Leaderboard puzzleId={preview.id} myRowId={progress.find(p => p.puzzleId === preview.id)?.rowId} />
      </> : puzzles.map(p => <button key={p.id} onClick={() => setPreview(p)}
        className="block w-full rounded-xl border bg-white p-4 text-left hover:border-primary">
        <p>{formatPuzzleDate(p.date)}</p><p className="text-sm text-muted-foreground">{p.category}</p>
        {progress.some(row => row.puzzleId === p.id) && <p className="text-sm text-green-700">Solved</p>}
      </button>)}
    </main>
  </div>;
}
