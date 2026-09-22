import { useCallback, useEffect, useRef, useState } from 'react';
import { pausePuzzle, revealHint, startPuzzle, submitWord, type GameState } from './gameApi';

// One queue per mounted account/puzzle. The database also serializes across devices.
export function useGame(puzzleId: string, onComplete: () => void) {
  const [state, setState] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const current = useRef<GameState | null>(null);
  const alive = useRef(true);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const apply = useCallback((next: GameState) => {
    if (!alive.current || (current.current && next.serverNow < current.current.serverNow)) return;
    const newlyCompleted = current.current && !current.current.completed && next.completed;
    current.current = next; setState(next); setError(null);
    if (newlyCompleted) onCompleteRef.current();
  }, []);
  const enqueue = useCallback(<T,>(job: () => Promise<T>): Promise<T> => {
    const task = queue.current.catch(() => {}).then(() => {
      if (!alive.current) throw new Error('This game is no longer open.');
      return job();
    });
    queue.current = task;
    return task;
  }, []);
  const resume = useCallback(async () => {
    try { await enqueue(async () => apply(await startPuzzle(puzzleId))); return true; }
    catch (err) { if (alive.current) setError(err instanceof Error ? err.message : 'Could not load puzzle. Retry.'); return false; }
  }, [puzzleId, apply, enqueue]);
  useEffect(() => {
    alive.current = true;
    void resume();
    return () => { alive.current = false; };
  }, [resume]);
  const pause = useCallback(async () => {
    try { await enqueue(async () => apply(await pausePuzzle(puzzleId))); return true; }
    catch (err) { if (alive.current) setError(err instanceof Error ? err.message : 'Could not pause puzzle. Retry.'); return false; }
  }, [puzzleId, apply, enqueue]);
  const checkWord = useCallback((index: number, guess: string) => enqueue(async () => {
    const response = await submitWord(puzzleId, index, guess);
    if (response.retryAfterSeconds != null) throw new Error(`Too many checks. Retry in ${response.retryAfterSeconds} seconds. Your progress is saved.`);
    apply(response.state);
    return response.correct;
  }), [puzzleId, enqueue, apply]);
  const hint = useCallback((index: number) => enqueue(async () => { apply(await revealHint(puzzleId, index)); }), [puzzleId, enqueue, apply]);
  return { state, error, resume, pause, checkWord, hint };
}
