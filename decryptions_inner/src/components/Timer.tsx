import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { formatTime, type GameState } from '../lib/gameApi';

export function Timer({ state }: { state: GameState }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const base = state.startedAt ? Math.max(0, Date.parse(state.serverNow) - Date.parse(state.startedAt)) : 0;
    const anchor = performance.now();
    const update = () => setSeconds(state.result?.timeSeconds ?? Math.floor((base + performance.now() - anchor) / 1000));
    update();
    const interval = window.setInterval(update, 250);
    return () => window.clearInterval(interval);
  }, [state]);
  return <div className="flex h-9 items-center gap-1.5 rounded-lg bg-accent px-2.5 text-sm" aria-label="Elapsed time">
    <Clock className="h-4 w-4 text-muted-foreground" /><span className="tabular-nums">{formatTime(seconds)}</span>
  </div>;
}
