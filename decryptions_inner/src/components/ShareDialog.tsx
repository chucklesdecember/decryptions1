import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { cn } from './ui/utils';
import { Share2, Check, Copy, Trophy } from 'lucide-react';
import { useState, useRef } from 'react';
import { toast } from 'sonner';
import posthog from 'posthog-js';

interface ShareDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  solveTime: number;
  hintsUsed: number;
  onLeaderboard?: () => void;
}

export function ShareDialog({ isOpen, onOpenChange, solveTime, hintsUsed, onLeaderboard }: ShareDialogProps) {
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const shareText = `🔐 Decryptions — ${dateStr}

Today's headline is hidden behind a rebus puzzle — come decode the news!

⏱️ My time: ${formatTime(solveTime)}
💡 ${hintsUsed} hint${hintsUsed !== 1 ? 's' : ''} used

Can you beat that? Play today's Decryptions puzzle. 📰`;

  const performCopy = () => {
    if (!textareaRef.current) return;

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard
        .writeText(shareText)
        .then(() => {
          setCopied(true);
          toast.success('Results copied! Paste to share with friends.');
          setTimeout(() => setCopied(false), 2000);
        })
        .catch(() => {
          textareaRef.current?.select();
          try {
            const successful = document.execCommand('copy');
            if (successful) {
              setCopied(true);
              toast.success('Results copied! Paste to share with friends.');
              setTimeout(() => setCopied(false), 2000);
              return;
            }
          } catch {
            // ignore and fallback to manual selection message
          }

          toast.error('Please manually select and copy the text above.');
          textareaRef.current?.select();
        });
      return;
    }

    textareaRef.current.select();
    try {
      const successful = document.execCommand('copy');
      if (successful) {
        setCopied(true);
        toast.success('Results copied! Paste to share with friends.');
        setTimeout(() => setCopied(false), 2000);
        return;
      }
    } catch {
      // ignore and fallback to manual selection message
    }

    toast.error('Please manually select and copy the text above.');
  };

  const handleCopy = () => {
    posthog.capture('copy_clicked');
    performCopy();
  };

  const handleShare = () => {
    posthog.capture('share_clicked');
    if (navigator.share && navigator.canShare && navigator.canShare({ text: shareText })) {
      navigator.share({
        title: 'Decryptions Puzzle',
        text: shareText,
      }).then(() => {
        toast.success('Thanks for sharing!');
      }).catch((err) => {
        // User cancelled the share, or share failed
        if (err instanceof Error && err.name !== 'AbortError') {
          console.log('Error sharing:', err);
          performCopy();
        }
      });
    } else {
      // Fallback to copy if share is not available
      performCopy();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>🎉 Puzzle Solved!</DialogTitle>
          <DialogDescription>
            Share your results with friends and challenge them to beat your time!
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="bg-accent p-4 rounded-lg space-y-2">
            <p className="text-center">
              <span className="text-2xl">⏱️</span>
            </p>
            <p className="text-center">
              You solved it in <span className="text-primary">{formatTime(solveTime)}</span>
            </p>
            <p className="text-center text-sm text-muted-foreground">
              Using {hintsUsed} hint{hintsUsed !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="bg-muted p-4 rounded-lg">
            <textarea
              ref={textareaRef}
              value={shareText}
              readOnly
              onClick={(e) => e.currentTarget.select()}
              className="w-full text-sm whitespace-pre-line bg-transparent border-none outline-none resize-none cursor-pointer"
              rows={7}
            />
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Click text to select • Cmd/Ctrl+C to copy
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {onLeaderboard && (
              <button
                type="button"
                className={cn(
                  'inline-flex w-full min-h-[52px] items-center justify-center gap-2 rounded-md px-4 py-2',
                  'text-base font-bold text-white shadow-lg transition-[filter,box-shadow]',
                  'ring-2 ring-amber-400/90 ring-offset-2 ring-offset-background',
                  'hover:brightness-110 hover:shadow-xl',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2',
                  '[&_svg]:pointer-events-auto [&_svg]:shrink-0',
                )}
                style={{
                  background:
                    'linear-gradient(to right, rgb(245 158 11), rgb(249 115 22), rgb(225 29 72))',
                  color: '#ffffff',
                }}
                onClick={() => {
                  onOpenChange(false);
                  onLeaderboard();
                }}
              >
                <Trophy className="h-6 w-6 shrink-0" aria-hidden />
                View leaderboard and results
              </button>
            )}
            <div className="flex flex-col sm:flex-row gap-2">
              <Button onClick={handleShare} className="flex-1 gap-2 bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600">
                <Share2 className="w-4 h-4" />
                Share Result
              </Button>
              <Button onClick={handleCopy} variant="outline" className="gap-2 sm:min-w-[100px]">
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-green-600" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
