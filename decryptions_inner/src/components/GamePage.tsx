import { useRef, useState } from 'react';
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
import { Pause, Play } from 'lucide-react';
import { Check } from 'lucide-react';
import { toast } from 'sonner';
import posthog from 'posthog-js';
import { buildShareText, copyShareText } from '../lib/shareResult';
import { NextPuzzleCountdown } from './NextPuzzleCountdown';

export function GamePage({ puzzle, onHome, onArchive, onStats }: { puzzle: PuzzleSummary; onHome: () => void; onArchive: () => void; onStats: () => void }) {
  const { refreshProgress, isGuest, requireAccount } = useAuth();
  const [share, setShare] = useState(false);
  const [copied, setCopied] = useState(false);
  const leaderboardRef = useRef<HTMLDivElement>(null);
  const [changingTimer, setChangingTimer] = useState(false);
  const game = useGame(puzzle.id, () => { setShare(true); void refreshProgress(); });
  const state = game.state;
  const result = state?.result;
  const navigate = async (target: 'home' | 'archive') => {
    if (changingTimer) return;
    setChangingTimer(true);
    if (state && !state.completed && !state.paused && !(await game.pause())) {
      setChangingTimer(false);
      return;
    }
    (target === 'home' ? onHome : onArchive)();
  };
  const togglePause = async () => {
    if (!state || state.completed || changingTimer) return;
    setChangingTimer(true);
    if (state.paused) await game.resume();
    else await game.pause();
    setChangingTimer(false);
  };
  const shareResult = async () => {
    if (!result) return;
    posthog.capture('share_clicked', { location: 'completed_page' });
    try {
      await copyShareText(buildShareText(formatPuzzleDate(puzzle.date), result.timeSeconds, state?.hintsUsed ?? 0, result.verified));
      setCopied(true);
      toast.success('Result copied — paste it anywhere.');
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy the result. Please try again.");
    }
  };
  const showLeaderboard = () => {
    setShare(false);
    window.requestAnimationFrame(() => leaderboardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };
  return <div className="min-h-app bg-gradient-to-br from-orange-50 via-yellow-50 to-pink-50">
    <header className="border-b bg-white/80 px-4 py-3 shadow-sm">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2">
        <button className="mr-auto text-xl font-semibold text-primary" onClick={() => void navigate('home')}>Decryptions</button>
        {state && <Timer state={state} />}
        {state && !state.completed && <Button variant="outline" size="icon" disabled={changingTimer} onClick={() => void togglePause()} aria-label={state.paused ? 'Resume puzzle' : 'Pause puzzle'} title={state.paused ? 'Resume puzzle' : 'Pause puzzle'}>{state.paused ? <Play className="size-4" /> : <Pause className="size-4" />}</Button>}
        <InstructionsDialog />
        <Button variant="outline" size="sm" disabled={changingTimer} onClick={() => void navigate('archive')}>Archive</Button>
        <AccountMenu onStats={onStats} />
      </div>
    </header>
    <main className="mx-auto flex max-w-3xl flex-col items-center gap-4 px-4 py-6">
      <h1 className="text-xl font-semibold">{result?.headline ?? "Decode the headline"}</h1>
      <p className="text-sm text-muted-foreground">{formatPuzzleDate(puzzle.date)} · {puzzle.category}</p>
      {game.error && <div role="alert" className="text-center text-red-700"><p>{game.error}</p><Button variant="outline" onClick={() => void game.resume()}>Retry connection</Button></div>}
      {!state && !game.error && <p role="status">Starting your puzzle…</p>}
      {state && <>
        {state.paused && !state.completed && <div className="rounded-xl bg-white p-8 text-center"><h2 className="text-lg font-semibold">Puzzle paused</h2><p>Your timer is stopped.</p><Button className="mt-4" size="icon" disabled={changingTimer} onClick={() => void togglePause()} aria-label="Resume puzzle" title="Resume puzzle"><Play className="size-4" /></Button></div>}
        <div className={state.paused && !state.completed ? 'hidden' : 'w-full'}>
          <RebusPuzzle words={state.words} completed={state.completed} checkWord={game.checkWord} revealHint={game.hint} />
        </div>
        {result && <>
          <p className="text-center">Solved in {formatTime(result.timeSeconds)} with {state.hintsUsed} hint{state.hintsUsed === 1 ? '' : 's'}.</p>
          <NextPuzzleCountdown />
          {!result.verified && <p className="text-sm text-amber-800">Unverified · recorded before server validation.</p>}
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={() => void shareResult()}>{copied && <Check className="mr-2 size-4" />}{copied ? 'Copied!' : 'Share'}</Button>
            {result.articleUrl && <Button asChild variant="outline"><a href={result.articleUrl} target="_blank" rel="noopener noreferrer">Read article</a></Button>}
          </div>
          <div ref={leaderboardRef} className="w-full scroll-mt-4"><Leaderboard puzzleId={puzzle.id} myRowId={result.rowId} /></div>
          <ShareDialog isOpen={share} onOpenChange={setShare} solveTime={result.timeSeconds} hintsUsed={state.hintsUsed}
            puzzleDate={formatPuzzleDate(puzzle.date)} puzzleId={puzzle.id} playerRowId={result.rowId}
            articleUrl={result.articleUrl ?? undefined} verified={result.verified} onLeaderboard={showLeaderboard}
            isGuest={isGuest} onRequireAccount={() => requireAccount()} onStats={onStats} />
        </>}
      </>}
    </main>
  </div>;
}
