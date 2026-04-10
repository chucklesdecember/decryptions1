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
}

export function RebusPuzzle({
  words,
  onComplete,
  completeOnAllWords = true,
  isPaused = false,
  hints,
  onUseHint,
}: RebusPuzzleProps) {
  const [userInputs, setUserInputs] = useState<string[]>(words.map(() => ''));
  const [correctAnswers, setCorrectAnswers] = useState<boolean[]>(words.map(() => false));
  const [revealedHints, setRevealedHints] = useState<boolean[]>(words.map(() => false));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    setUserInputs(words.map(() => ''));
    setCorrectAnswers(words.map(() => false));
    setRevealedHints(words.map(() => false));
    inputRefs.current = [];
  }, [words]);

  useEffect(() => {
    if (!completeOnAllWords) return;
    const allCorrect = correctAnswers.every((isCorrect) => isCorrect);
    if (allCorrect && correctAnswers.length > 0) {
      onComplete();
    }
  }, [completeOnAllWords, correctAnswers, onComplete]);

  const handleInputChange = (index: number, value: string) => {
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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-3xl">
      {words.map((word, index) => (
        <PuzzleBox
          key={index}
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
            if (!revealedHints[index]) {
              const updated = [...revealedHints];
              updated[index] = true;
              setRevealedHints(updated);
              onUseHint();
            }
          }}
        />
      ))}
    </div>
  );
}
