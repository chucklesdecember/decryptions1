import { useEffect, useState } from "react";
import { BarChart3, Flame, Lightbulb, Trophy } from "lucide-react";
import { useAuth } from "../lib/auth";
import { fetchAccountStats, formatPuzzleDate, formatTime, type AccountStats } from "../lib/gameApi";
import { AccountMenu } from "./AccountMenu";
import { Button } from "./ui/button";

export function StatsPage({ onBack }: { onBack: () => void }) {
  const { isGuest, requireAccount } = useAuth();
  const [stats, setStats] = useState<AccountStats | null>(null); const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (isGuest) return; fetchAccountStats().then(setStats).catch(e => setError(e.message)); }, [isGuest]);
  if (isGuest) return <main className="min-h-app bg-orange-50 px-4 py-16"><section className="mx-auto max-w-md rounded-2xl bg-white p-8 text-center shadow-sm"><BarChart3 className="mx-auto mb-3 size-8" /><h1 className="text-2xl font-semibold">Your Decryptions stats</h1><p className="mt-2 text-muted-foreground">Create an account to keep your personal history and see your puzzle insights.</p><Button className="mt-5" onClick={() => requireAccount()}>Save my play</Button></section></main>;
  const cards = stats ? [
    ["Puzzles solved", String(stats.completed), Trophy], ["Current streak", `${stats.currentStreak} day${stats.currentStreak === 1 ? "" : "s"}`, Flame],
    ["Best time", stats.bestSeconds == null ? "—" : formatTime(stats.bestSeconds), BarChart3], ["Average time", stats.averageSeconds == null ? "—" : formatTime(stats.averageSeconds), Lightbulb],
  ] as const : [];
  return <div className="min-h-app bg-gradient-to-br from-orange-50 via-yellow-50 to-pink-50"><header className="border-b bg-white/80 px-4 py-3"><div className="mx-auto flex max-w-3xl items-center gap-3"><Button variant="outline" onClick={onBack}>Back</Button><h1 className="flex-1 text-lg font-semibold">Your stats</h1><AccountMenu /></div></header><main className="mx-auto max-w-3xl px-4 py-8"><section className="rounded-2xl bg-white p-6 shadow-sm"><p className="text-sm font-medium text-muted-foreground">YOUR DECRYPTIONS ANALYSIS</p><h2 className="mt-1 text-3xl font-semibold">Your daily puzzle score</h2><p className="mt-2 text-muted-foreground">A clear view of your speed, streak, hints, and recent games.</p></section>{error ? <p className="mt-6 text-red-700">{error}</p> : !stats ? <p className="mt-6">Loading your insights…</p> : <><section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">{cards.map(([label, value, Icon]) => <div key={label} className="rounded-xl border bg-white p-4"><Icon className="mb-3 size-5 text-orange-600" /><p className="text-2xl font-semibold">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div>)}</section><section className="mt-6 rounded-2xl border bg-white p-5"><h2 className="text-lg font-semibold">Recent scores</h2>{stats.latestRank && <p className="mt-1 text-sm text-muted-foreground">Your latest verified solve placed #{stats.latestRank} among today’s completed times.</p>}<div className="mt-4 space-y-2">{stats.recent.length ? stats.recent.map(row => <div key={row.date} className="flex items-center justify-between rounded-lg bg-orange-50 px-3 py-2"><span>{formatPuzzleDate(row.date)}</span><span className="text-sm"><b>{formatTime(row.timeSeconds)}</b> · {row.hintsUsed} hint{row.hintsUsed === 1 ? "" : "s"}</span></div>) : <p className="text-sm text-muted-foreground">Finish a puzzle to begin your history.</p>}</div></section></>}</main></div>;
}
