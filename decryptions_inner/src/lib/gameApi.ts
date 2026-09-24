import { supabase } from './supabase';

export interface PuzzleSummary { id: string; date: string; category: string }
export interface PuzzleClue { type: 'image' | 'text' | 'symbol' | 'operator'; content: string; alt?: string; layout?: 'wide' }
export interface PublicWord { clues: PuzzleClue[]; answerLength: number; acceptedAnswer: string | null; hint: string | null }
export interface ProgressRow {
  puzzleId: string; timeSeconds: number; hintsUsed: number;
  solvedAt: string; rowId: string | null; verified: boolean;
}
export interface AccountStats {
  completed: number; bestSeconds: number | null; averageSeconds: number | null; totalHints: number; currentStreak: number; latestRank: number | null;
  recent: Array<{ date: string; timeSeconds: number; hintsUsed: number }>;
}
export interface GameState extends PuzzleSummary {
  startedAt: string | null; serverNow: string; words: PublicWord[];
  completed: boolean; hintsUsed: number; elapsedSeconds: number; paused: boolean;
  result: (Omit<ProgressRow, 'puzzleId' | 'hintsUsed'> & { headline: string; articleUrl: string | null }) | null;
}
export async function gameRpc<T>(name: string, params?: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new Error('The game is currently unavailable. Please try again later.');
  const { data, error } = await supabase.rpc(name, params);
  if (error) {
    if (error.code === '42501' || error.code === 'PGRST301') throw new Error('Please sign in again to continue. Your attempt is saved.');
    if (error.code === 'P0002') throw new Error('This puzzle is unavailable. Return home and try again.');
    if (error.code === 'P0003') throw new Error('Create a free account or log in to play archived puzzles.');
    if (error.code === 'P0004') throw new Error('Resume the puzzle before checking an answer or using a hint.');
    throw new Error('Could not reach the game server. Check your connection and retry.');
  }
  if (data == null) throw new Error('The game server returned no result. Please retry.');
  return data as T;
}
export const listPuzzles = () => gameRpc<PuzzleSummary[]>('list_puzzles');
export const startPuzzle = (puzzleId: string) => gameRpc<GameState>('start_puzzle', { p_puzzle_id: puzzleId });
export const pausePuzzle = (puzzleId: string) => gameRpc<GameState>('pause_puzzle', { p_puzzle_id: puzzleId });
export const fetchProgress = () => gameRpc<ProgressRow[]>('get_my_progress');
export const fetchAccountStats = () => gameRpc<AccountStats>('get_my_stats');
export const revealHint = (puzzleId: string, index: number) => gameRpc<GameState>('reveal_hint', { p_puzzle_id: puzzleId, p_word_index: index });
export const submitWord = (puzzleId: string, index: number, guess: string) =>
  gameRpc<{ state: GameState; correct: boolean; retryAfterSeconds?: never } | { retryAfterSeconds: number; state?: never; correct?: never }>(
    'submit_word', { p_puzzle_id: puzzleId, p_word_index: index, p_guess: guess });
export function formatPuzzleDate(date: string) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'long', day: 'numeric', year: 'numeric' });
}
export function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;
}
