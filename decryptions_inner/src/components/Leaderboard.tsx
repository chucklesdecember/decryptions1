import { useEffect, useState } from 'react';
import { Lightbulb } from 'lucide-react';
import { fetchLeaderboardEntries, type SolveEntry } from '../lib/leaderboardApi';
import { formatTime } from '../lib/gameApi';
import { Button } from './ui/button';
export function Leaderboard({ puzzleId, myRowId }: { puzzleId: string; myRowId?: string | null }) {
  const [entries, setEntries] = useState<SolveEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true; setLoading(true); setError(null);
    fetchLeaderboardEntries(puzzleId).then(rows => { if (active) setEntries(rows); })
      .catch(err => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [puzzleId, myRowId, retry]);
  return <section className="mb-4 rounded-xl border bg-white p-4 shadow-md sm:p-5">
    <h2 className="mb-1 text-xl font-semibold">Leaderboard</h2>
    <p className="mb-4 text-sm text-muted-foreground">Fastest times · older scores are labeled Unverified.</p>
    {loading ? <p>Loading leaderboard…</p> : error ? <div role="alert"><p>{error}</p><Button variant="outline" onClick={() => setRetry(n => n + 1)}>Retry leaderboard</Button></div> : entries.length === 0 ? <p>No solves yet. Be the first!</p> : <div className="space-y-2">
      {entries.map((entry, index) => <div key={entry.id}
        className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 ${entry.id === myRowId ? 'border-orange-400 bg-orange-50' : 'border-gray-200 bg-gray-50'}`}>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="w-7 shrink-0 text-xs tabular-nums">{index + 1}.</span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{entry.display_name}{entry.id === myRowId ? ' (you)' : ''}</p>
            {!entry.verified && <p className="text-xs text-amber-800">Unverified</p>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!!entry.hints_used && <span className="flex items-center gap-0.5 text-xs" aria-label={`${entry.hints_used} hints used`}>
            <Lightbulb className="size-3.5 text-amber-600" />{entry.hints_used}
          </span>}
          <span className="text-sm font-semibold tabular-nums">{formatTime(entry.time_seconds)}</span>
        </div>
      </div>)}
    </div>}
  </section>;
}
