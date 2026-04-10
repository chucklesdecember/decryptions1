import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Share2, Check, Copy, Trophy } from 'lucide-react';
import { useState, useRef } from 'react';
import { toast } from 'sonner';

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

  const handleCopy = () => {
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

  const handleShare = () => {
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
          handleCopy();
        }
      });
    } else {
      // Fallback to copy if share is not available
      handleCopy();
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
              <Button
                type="button"
                className="w-full min-h-[52px] gap-2 text-base font-semibold bg-black text-white border-2 border-gray-800 shadow-sm hover:bg-gray-800 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 transition-[box-shadow,background-color] duration-150"
                onClick={() => {
                  onOpenChange(false);
                  onLeaderboard();
                }}
              >
                <Trophy className="w-6 h-6 shrink-0" />
                View leaderboard and results
              </Button>
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
