import { useEffect, useState } from 'react';
import { LandingPage } from './components/LandingPage';
import { ArchiveList } from './components/ArchiveView';
import { GamePage } from './components/GamePage';
import { StatsPage } from './components/StatsPage';
import { InstructionsDialog } from './components/InstructionsDialog';
import { Button } from './components/ui/button';
import { useAuth } from './lib/auth';
import { formatPuzzleDate, listPuzzles, type PuzzleSummary } from './lib/gameApi';

type Selection = { puzzle: PuzzleSummary; userId: string };

export default function App() {
  const auth = useAuth();
  const [puzzles, setPuzzles] = useState<PuzzleSummary[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [archive, setArchive] = useState(false);
  const [stats, setStats] = useState(false);
  const [selected, setSelected] = useState<Selection | null>(null);
  const [firstPuzzle, setFirstPuzzle] = useState<Selection | null>(null);
  useEffect(() => {
    let active = true;
    setLoaded(false); setError(null);
    listPuzzles().then(rows => { if (active) { setPuzzles(rows); setLoaded(true); } })
      .catch(err => { if (active) { setError(err.message); setLoaded(true); } });
    return () => { active = false; };
  }, [reload]);
  useEffect(() => {
    if (auth.status === 'signed_out') { setSelected(null); setFirstPuzzle(null); }
  }, [auth.status]);
  const play = (puzzle: PuzzleSummary) => auth.requirePlayer((kind, userId) => {
    if (kind === 'signup' || kind === 'guest') setFirstPuzzle({ puzzle, userId });
    else setSelected({ puzzle, userId });
  });
  const home = () => { setSelected(null); setArchive(false); setStats(false); };
  if (selected && auth.user?.id === selected.userId) return <GamePage key={`${selected.userId}:${selected.puzzle.id}`} puzzle={selected.puzzle}
    onHome={home} onArchive={() => { setSelected(null); setArchive(true); }} onStats={() => { setSelected(null); setStats(true); }} />;
  if (stats) return <StatsPage onBack={home} />;
  if (archive) return <ArchiveList puzzles={puzzles.slice(1)} onBack={home} onPlay={play} />;
  return <>
    <LandingPage puzzleDate={puzzles[0] ? formatPuzzleDate(puzzles[0].date) : ''}
      playLabel="Play"
      unavailable={!puzzles.length || !!error || auth.status === 'loading' || auth.syncing} onStats={() => setStats(true)}
      onStartGame={() => { if (puzzles[0]) play(puzzles[0]); }} onOpenArchive={() => setArchive(true)} />
    {(!loaded || error || !puzzles.length) && <div className="mx-auto max-w-md px-4 pb-6 text-center" role="status">
      <p>{!loaded ? 'Loading puzzles…' : error ?? 'No puzzles are available yet.'}</p>
      {loaded && <Button variant="outline" className="mt-2" onClick={() => setReload(n => n + 1)}>Retry</Button>}
    </div>}
    <InstructionsDialog open={firstPuzzle != null} showPlayButton onOpenChange={open => {
      if (!open && firstPuzzle) { setSelected(firstPuzzle); setFirstPuzzle(null); }
    }} />
  </>;
}
