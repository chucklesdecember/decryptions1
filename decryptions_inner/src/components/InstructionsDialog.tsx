import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import { Button } from './ui/button';
import { ArrowRight, HelpCircle, Lightbulb, Play, Timer } from 'lucide-react';

interface InstructionsDialogProps {
  onOpenChange?: (open: boolean) => void;
  /** When set, dialog is controlled (no toolbar trigger); parent drives `open`. */
  open?: boolean;
  /** Big primary action at bottom (e.g. first-time onboarding); still keep dialog close (X). */
  showPlayButton?: boolean;
}

export function InstructionsDialog({ onOpenChange, open, showPlayButton }: InstructionsDialogProps) {
  const isControlled = open !== undefined;
  return (
    <Dialog open={isControlled ? open : undefined} onOpenChange={onOpenChange}>
      {!isControlled && (
        <DialogTrigger asChild>
          <Button variant="outline" size="icon">
            <HelpCircle className="w-5 h-5" />
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-[calc(100%-1.5rem)] gap-0 overflow-hidden rounded-2xl border-2 border-black/10 bg-[#fffdf5] p-0 shadow-2xl sm:max-w-lg">
        <DialogHeader className="border-b border-black/10 bg-white px-5 pb-5 pt-7 text-left sm:px-7">
          <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-black/50">
            <span className="flex size-7 items-center justify-center rounded-lg bg-black text-sm font-black text-white">D</span>
            Daily puzzle
          </div>
          <DialogTitle className="text-2xl font-bold tracking-tight sm:text-3xl">How to play</DialogTitle>
          <DialogDescription className="mt-2 max-w-sm text-[15px] leading-6 text-black/60">
            Decode six rebus clues to reveal today’s news headline.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5 px-5 py-5 text-[15px] leading-6 sm:px-7 sm:py-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-black/10 bg-white p-3">
              <div className="mb-2 flex size-7 items-center justify-center rounded-full bg-black text-sm font-bold text-white">1</div>
              <p className="font-semibold text-black">Read the clues</p>
              <p className="mt-1 text-[13px] leading-5 text-black/55">Each box is one word.</p>
            </div>
            <div className="rounded-xl border border-black/10 bg-white p-3">
              <div className="mb-2 flex size-7 items-center justify-center rounded-full bg-black text-sm font-bold text-white">2</div>
              <p className="font-semibold text-black">Build the word</p>
              <p className="mt-1 text-[13px] leading-5 text-black/55">Combine sounds, images, and letters.</p>
            </div>
            <div className="rounded-xl border border-black/10 bg-white p-3">
              <div className="mb-2 flex size-7 items-center justify-center rounded-full bg-black text-sm font-bold text-white">3</div>
              <p className="font-semibold text-black">Beat the clock</p>
              <p className="mt-1 text-[13px] leading-5 text-black/55">Solve today’s headline once.</p>
            </div>
          </div>

          <div className="rounded-xl border border-black/10 bg-white p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-bold text-black">
              <ArrowRight className="size-4" />
              Example
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
              <span className="rounded-md bg-black px-2.5 py-1.5 text-white">TRUMPET</span>
              <span className="text-xl text-black/40">−</span>
              <span className="rounded-md bg-black px-2.5 py-1.5 text-white">T</span>
              <span className="text-xl text-black/40">=</span>
              <span className="rounded-md border-2 border-black bg-[#d9f99d] px-2.5 py-1.5 text-black">RUMPET</span>
            </div>
            <p className="mt-2 text-[13px] leading-5 text-black/55">A minus sign means remove the clue on the right from the clue on the left.</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex gap-3 rounded-xl bg-black/[0.04] p-3">
              <Lightbulb className="mt-0.5 size-5 shrink-0 text-black/60" />
              <div><p className="font-semibold text-black">Use the hints</p><p className="mt-0.5 text-[13px] leading-5 text-black/55">Images may be sounds or homophones. The number shows the answer length.</p></div>
            </div>
            <div className="flex gap-3 rounded-xl bg-black/[0.04] p-3">
              <Timer className="mt-0.5 size-5 shrink-0 text-black/60" />
              <div><p className="font-semibold text-black">Your time is live</p><p className="mt-0.5 text-[13px] leading-5 text-black/55">The timer keeps running if you leave or hide the puzzle.</p></div>
            </div>
          </div>

          <div>
            {showPlayButton ? (
              <div className="border-t border-black/10 pt-5">
                <Button
                  type="button"
                  size="xl"
                  className="h-12 w-full rounded-full bg-black text-base font-semibold text-white hover:bg-black/80"
                  onClick={() => onOpenChange?.(false)}
                >
                  <Play className="size-5" />
                  Play
                </Button>
                <p className="mt-2 text-center text-xs text-black/45">One puzzle, every day.</p>
              </div>
            ) : (
              <p className="text-center text-xs text-black/45">Tap outside this box or press Escape to close.</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
