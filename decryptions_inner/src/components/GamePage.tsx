import { useState } from 'react';
import { useGame } from '../lib/useGame';
import { useAuth } from '../lib/auth';
import { formatPuzzleDate, formatTime, type PuzzleSummary } from '../lib/gameApi';
import { RebusPuzzle } from './RebusPuzzle';
import { Timer } from './Timer';
import { ShareDialog } from './ShareDialog';
import { InstructionsDialog } from './InstructionsDialog';
import { Leaderboard } from './Leaderboard';
import { AccountMenu } from './AccountMenu';
import { Button } from './ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './ui/alert-dialog';

export function GamePage({ puzzle, onHome, onArchive }: { puzzle: PuzzleSummary; onHome: () => void; onArchive: () => void }) {
  const { refreshProgress } = useAuth();
  const [hidden, setHidden] = useState(false);
  const [share, setShare] = useState(false);
  const [results, setResults] = useState(false);
  const [leave, setLeave] = useState<'home' | 'archive' | null>(null);
  const game = useGame(puzzle.id, () => { setShare(true); void refreshProgress(); });
  const state = game.state;
  const result = state?.result;
  const navigate = (target: 'home' | 'archive') => {
    if (state && !state.completed) setLeave(target);
    else (target === 'home' ? onHome : onArchive)();
  };
  return <div className="min-h-app bg-gradient-to-br from-orange-50 via-yellow-50 to-pink-50">
    <header className="border-b bg-white/80 px-4 py-3 shadow-sm">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2">
        <button className="mr-auto text-xl font-semibold text-primary" onClick={() => navigate('home')}>Decryptions</button>
        {state && <Timer state={state} />}
        {state && !state.completed && <Button variant="outline" size="sm" onClick={() => setHidden(h => !h)}>{hidden ? 'Show puzzle' : 'Hide puzzle'}</Button>}
        <InstructionsDialog />
        <Button variant="outline" size="sm" onClick={() => navigate('archive')}>Archive</Button>
        <AccountMenu />
      </div>
    </header>
    <main className="mx-auto flex max-w-3xl flex-col items-center gap-4 px-4 py-6">
      <h1 className="text-xl font-semibold">{result?.headline ?? "Decode the headline"}</h1>
      <p className="text-sm text-muted-foreground">{formatPuzzleDate(puzzle.date)} · {puzzle.category}</p>
      {game.error && <div role="alert" className="text-center text-red-700"><p>{game.error}</p><Button variant="outline" onClick={() => void game.resume()}>Retry connection</Button></div>}
      {!state && !game.error && <p role="status">Starting your puzzle…</p>}
      {state && <>
        {!state.completed && <p className="text-center text-xs text-muted-foreground">Time keeps running when you hide the puzzle or leave. Returning resumes this attempt.</p>}
        {hidden && !state.completed && <div className="rounded-xl bg-white p-8 text-center"><h2 className="text-lg font-semibold">Puzzle hidden</h2><p>Your timer is still running.</p><Button className="mt-4" onClick={() => setHidden(false)}>Show puzzle</Button></div>}
        <div className={hidden && !state.completed ? 'hidden' : 'w-full'}>
          <RebusPuzzle words={state.words} completed={state.completed} checkWord={game.checkWord} revealHint={game.hint} />
        </div>
        {result && <>
          <p className="text-center">Solved in {formatTime(result.timeSeconds)} with {state.hintsUsed} hint{state.hintsUsed === 1 ? '' : 's'}.</p>
          {!result.verified && <p className="text-sm text-amber-800">Unverified · recorded before server validation.</p>}
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={() => setShare(true)}>Share result</Button>
            <Button variant="outline" onClick={() => setResults(r => !r)}>Leaderboard</Button>
            {result.articleUrl && <Button asChild variant="outline"><a href={result.articleUrl} target="_blank" rel="noopener noreferrer">Read article</a></Button>}
          </div>
          {results && <div className="w-full"><Leaderboard puzzleId={puzzle.id} myRowId={result.rowId} /></div>}
          <ShareDialog isOpen={share} onOpenChange={setShare} solveTime={result.timeSeconds} hintsUsed={state.hintsUsed}
            puzzleDate={formatPuzzleDate(puzzle.date)} puzzleId={puzzle.id} playerRowId={result.rowId}
            articleUrl={result.articleUrl ?? undefined} verified={result.verified} onLeaderboard={() => setResults(true)} />
        </>}
      </>}
    </main>
    <AlertDialog open={leave != null} onOpenChange={open => { if (!open) setLeave(null); }}>
      <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Leave this puzzle?</AlertDialogTitle>
        <AlertDialogDescription>Your progress is saved. The timer will keep running until you finish.</AlertDialogDescription>
      </AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Stay</AlertDialogCancel>
        <AlertDialogAction onClick={() => { const target = leave; setLeave(null); (target === 'archive' ? onArchive : onHome)(); }}>Leave</AlertDialogAction>
      </AlertDialogFooter></AlertDialogContent>
    </AlertDialog>
  </div>;
}
