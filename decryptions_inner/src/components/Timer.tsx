import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

interface TimerProps {
  isActive: boolean;
  onTimeUpdate?: (time: number) => void;
}

export function Timer({ isActive, onTimeUpdate }: TimerProps) {
  const [time, setTime] = useState(0);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    if (isActive) {
      interval = setInterval(() => {
        setTime((prevTime) => prevTime + 1);
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActive]);

  useEffect(() => {
    if (isActive) {
      onTimeUpdate?.(time);
    }
  }, [time, isActive, onTimeUpdate]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex h-9 items-center gap-1.5 rounded-lg bg-accent px-2.5 text-sm sm:gap-2 sm:px-3 sm:text-base">
      <Clock className="w-4 h-4 shrink-0 text-muted-foreground" />
      <span className="tabular-nums">{formatTime(time)}</span>
    </div>
  );
}
