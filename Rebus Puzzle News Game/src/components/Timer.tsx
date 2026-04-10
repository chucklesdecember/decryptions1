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
    <div className="flex items-center gap-2 px-4 py-2 bg-accent rounded-lg">
      <Clock className="w-4 h-4 text-muted-foreground" />
      <span className="tabular-nums">{formatTime(time)}</span>
    </div>
  );
}
