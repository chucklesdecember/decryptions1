import React, { useState, useEffect, useRef } from 'react';
import { PuzzleBox } from './PuzzleBox';

interface PuzzleClue {
  type: 'image' | 'text' | 'symbol' | 'operator';
  content: string;
  alt?: string;
}

interface PuzzleWord {
  answer: string;
  clues: PuzzleClue[];
}

interface RebusPuzzleProps {
  words: PuzzleWord[];
  onComplete: () => void;
  /** When false, solving all words does not call onComplete (e.g. headline submission wins instead). */
  completeOnAllWords?: boolean;
  isPaused?: boolean;
  hints: string[];
  onUseHint: () => void;
  /** When true, show solved answers read-only and do not fire onComplete */
  interactionLocked?: boolean;
}

export function RebusPuzzle({
  words,
  onComplete,
  completeOnAllWords = true,
  isPaused = false,
  hints,
  onUseHint,
  interactionLocked = false,
}: RebusPuzzleProps) {
  const [userInputs, setUserInputs] = useState<string[]>(() =>
    interactionLocked ? words.map((w) => w.answer.toUpperCase()) : words.map(() => ''),
  );
  const [correctAnswers, setCorrectAnswers] = useState<boolean[]>(() =>
    interactionLocked ? words.map(() => true) : words.map(() => false),
  );
  const [revealedHints, setRevealedHints] = useState<boolean[]>(words.map(() => false));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (interactionLocked) {
      setUserInputs(words.map((w) => w.answer.toUpperCase()));
      setCorrectAnswers(words.map(() => true));
      setRevealedHints(words.map(() => false));
    } else {
      setUserInputs(words.map(() => ''));
      setCorrectAnswers(words.map(() => false));
      setRevealedHints(words.map(() => false));
    }
    inputRefs.current = [];
  }, [words, interactionLocked]);

  useEffect(() => {
    if (!completeOnAllWords || interactionLocked) return;
    const allCorrect = correctAnswers.every((isCorrect) => isCorrect);
    if (allCorrect && correctAnswers.length > 0) {
      onComplete();
    }
  }, [completeOnAllWords, interactionLocked, correctAnswers, onComplete]);

  const handleInputChange = (index: number, value: string) => {
    if (interactionLocked) return;
    const newInputs = [...userInputs];
    newInputs[index] = value;
    setUserInputs(newInputs);

    const newCorrect = [...correctAnswers];
    const isCorrect = value.toUpperCase() === words[index].answer.toUpperCase();
    newCorrect[index] = isCorrect;
    setCorrectAnswers(newCorrect);

    // Auto-focus next input when current word is correct
    if (isCorrect && index < words.length - 1) {
      // Find next unanswered question
      for (let i = index + 1; i < words.length; i++) {
        if (!newCorrect[i]) {
          setTimeout(() => {
            inputRefs.current[i]?.focus();
          }, 300);
          break;
        }
      }
    }
  };

  return (
    <div className="grid w-full max-w-3xl grid-cols-1 gap-3 md:grid-cols-2">
      {words.map((word, index) => (
        <div key={index} className="min-w-0 w-full max-w-full overflow-hidden">
          <PuzzleBox
            ref={(el) => {
              inputRefs.current[index] = el;
            }}
            clues={word.clues}
            answer={word.answer}
            userInput={userInputs[index]}
            onInputChange={(value) => handleInputChange(index, value)}
            isCorrect={correctAnswers[index]}
            isPaused={isPaused}
            hint={hints[index]}
            onRevealHint={() => {
              if (interactionLocked) return;
              if (!revealedHints[index]) {
                const updated = [...revealedHints];
                updated[index] = true;
                setRevealedHints(updated);
                onUseHint();
              }
            }}
            locked={interactionLocked}
          />
        </div>
      ))}
    </div>
  );
}
