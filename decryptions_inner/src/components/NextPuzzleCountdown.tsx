import { useEffect, useState } from 'react';

const formatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  year: 'numeric', month: 'numeric', day: 'numeric',
  hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23',
});

function localParts(date: Date) {
  return Object.fromEntries(
    formatter.formatToParts(date)
      .filter(part => part.type !== 'literal')
      .map(part => [part.type, Number(part.value)]),
  ) as Record<string, number>;
}

function nextEasternMidnight(now: Date) {
  const current = localParts(now);
  const nextDate = new Date(Date.UTC(current.year, current.month - 1, current.day + 1));
  const desired = Date.UTC(nextDate.getUTCFullYear(), nextDate.getUTCMonth(), nextDate.getUTCDate());
  let guess = desired;
  for (let i = 0; i < 3; i++) {
    const actual = localParts(new Date(guess));
    const represented = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second);
    guess += desired - represented;
  }
  return guess;
}

export function NextPuzzleCountdown() {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setSeconds(Math.max(0, Math.ceil((nextEasternMidnight(now) - now.getTime()) / 1000)));
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const countdown = `${Math.floor(seconds / 3600).toString().padStart(2, '0')}:${Math.floor((seconds % 3600) / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;

  return (
    <p className="text-center text-sm text-muted-foreground">
      Next puzzle in <span className="font-semibold tabular-nums text-foreground">{countdown}</span>
      <span className="block text-xs">at midnight ET</span>
    </p>
  );
}

