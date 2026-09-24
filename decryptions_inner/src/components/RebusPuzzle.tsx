import { useEffect, useRef, useState } from 'react';
import { PuzzleBox } from './PuzzleBox';
import { Button } from './ui/button';
import type { PublicWord } from '../lib/gameApi';

interface Props {
  words: PublicWord[];
  completed: boolean;
  checkWord: (index: number, guess: string) => Promise<boolean>;
  revealHint: (index: number) => Promise<void>;
}
export function RebusPuzzle({ words, completed, checkWord, revealHint }: Props) {
  const [inputs, setInputs] = useState(() => words.map(() => ''));
  const inputsRef = useRef(inputs);
  const [checks, setChecks] = useState<Record<number, { value: string; pending?: boolean; incorrect?: boolean; error?: string }>>({});
  const timers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const alive = useRef(true);
  const wordsRef = useRef(words); wordsRef.current = words;
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; Object.values(timers.current).forEach(clearTimeout); };
  }, []);
  const validate = async (index: number, value: string) => {
    if (wordsRef.current[index].acceptedAnswer != null) return;
    setChecks(c => ({ ...c, [index]: { value, pending: true } }));
    try {
      const correct = await checkWord(index, value);
      if (!alive.current || inputsRef.current[index] !== value) return;
      setChecks(c => ({ ...c, [index]: { value, incorrect: !correct } }));
      if (correct) {
        const next = wordsRef.current.findIndex((w, i) => i > index && w.acceptedAnswer == null);
        if (next >= 0) refs.current[next]?.focus();
      }
    } catch (err) {
      if (alive.current && inputsRef.current[index] === value) setChecks(c => ({ ...c, [index]: {
        value, error: err instanceof Error ? err.message : 'Could not check this word. Retry.',
      } }));
    }
  };
  const change = (index: number, value: string) => {
    const next = [...inputsRef.current]; next[index] = value;
    inputsRef.current = next; setInputs(next);
    clearTimeout(timers.current[index]);
    setChecks(c => ({ ...c, [index]: { value } }));
    // Canonical length is public, but private accepted aliases may be longer
    // (for example, "19" also accepting "NINETEEN"). Check any completed-or-
    // longer entry after the user pauses typing so aliases reach the server.
    if (value.length >= words[index].answerLength) timers.current[index] = setTimeout(() => void validate(index, value), 300);
  };
  return <div className="grid w-full max-w-3xl grid-cols-1 gap-3 md:grid-cols-2">
    {words.map((word, index) => {
      const checked = checks[index]?.value === inputs[index] ? checks[index] : undefined;
      return <div key={index} className="min-w-0">
        <PuzzleBox ref={el => { refs.current[index] = el; }} clues={word.clues} answerLength={word.answerLength}
          label={`Word ${index + 1}`} userInput={word.acceptedAnswer ?? inputs[index]}
          onInputChange={value => change(index, value)} isCorrect={word.acceptedAnswer != null}
          incorrect={checked?.incorrect} hint={word.hint} onRevealHint={() => revealHint(index)} locked={completed} />
        {checked?.pending && !word.acceptedAnswer && <p className="mt-1 text-xs text-muted-foreground" role="status">Checking…</p>}
        {checked?.error && !word.acceptedAnswer && <div className="mt-1 text-sm text-red-700" role="alert">
          <p>{checked.error}</p><Button variant="outline" size="sm" onClick={() => void validate(index, inputsRef.current[index])}>Retry word {index + 1}</Button>
        </div>}
      </div>;
    })}
  </div>;
}
