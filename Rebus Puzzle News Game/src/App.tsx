import React, { useState, useCallback } from "react";
import { RebusPuzzle } from "./components/RebusPuzzle";
import { Timer } from "./components/Timer";
import { InstructionsDialog } from "./components/InstructionsDialog";
import { ShareDialog } from "./components/ShareDialog";
import { LandingPage } from "./components/LandingPage";
import { Button } from "./components/ui/button";
import { Pause, Play } from "lucide-react";
import { Toaster } from "./components/ui/sonner";

// Mock puzzle data - "Judge Pauses Shutdown Layoffs"
const puzzleData = {
  headline: "French Treasures Stolen",
  date: "October 20, 2025",
  category: "World News",
  words: [
    {
      answer: "FRENCH",
      clues: [
        { type: "operator" as const, content: "(" },
        {
          type: "image" as const,
          content:
            "https://media.istockphoto.com/id/542571172/vector/golden-vector-frame-with-stucco-ornaments.jpg?s=612x612&w=0&k=20&c=LnADI8S-hvUIUit4NLXubVYiMw_KYNPE005gJxqXDnM=",
          alt: "Frame",
        },
        { type: "operator" as const, content: "-" },
        {
          type: "image" as const,
          content:
            "https://www.nicepng.com/png/detail/261-2613212_aim-bow-and-arrow-clipart-aim-clipart.png",
          alt: "Ame",
        },
        { type: "operator" as const, content: ") + (" },
        {
          type: "image" as const,
          content:
            "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSdsMSYpOKgFe4eWnexSHxJFDY3uKQOHxIYhw&s",
          alt: "Bench",
        },
        { type: "operator" as const, content: "-"},
        {
          type: "image" as const,
          content:
            "https://i.etsystatic.com/13434992/r/il/3bf90f/3219303725/il_fullxfull.3219303725_kovf.jpg",
          alt: "Bee",
        },
        { type: "operator" as const, content: ")"},
        
      ],
    },
    {
      answer: "TREASURES",
      clues: [
        { type: "operator" as const, content: "(" },
        {
          type: "image" as const,
          content:
            "https://images.rawpixel.com/image_800/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA1L2pvYjcyNS0wMzYuanBn.jpg",
          alt: "Tread",
        },
        { type: "operator" as const, content: "- AD) + (" },
        {
          type: "image" as const,
          content:
            "https://media.istockphoto.com/id/1212944319/vector/flat-design-of-happy-surfer-boy.jpg?s=612x612&w=0&k=20&c=1ejj72eVjVlBcDSKSLoq48UkajCPXxqkm3xEjNBh2o8=",
          alt: "Surfer",
        },
        { type: "operator" as const, content: "-" },
        {
          type: "image" as const,
          content:
            "https://gallery.yopriceville.com/var/albums/Backgrounds/Fur_Background.jpg?m=1629744982",
          alt: "Fur",
        },
        { type: "operator" as const, content: ") + ES" },
      ],
    },
    {
      answer: "STOLEN",
      clues: [
        { type: "operator" as const, content: "(" },
        {
          type: "image" as const,
          content:
            "https://media.istockphoto.com/id/1221686500/vector/stop-sign-red-forbidding-sign-with-human-hand-in-octagon-shape-stop-hand-gesture-do-not.jpg?s=612x612&w=0&k=20&c=gl2IwI_EhZKrhb0SYBwAY4Mw4B9xtcJXvJUhZgK7bUM=",
          alt: "Stop",
        },
        { type: "operator" as const, content: "-" },
        {
          type: "image" as const,
          content:
            "https://media.istockphoto.com/id/1458175482/vector/cute-peas-cartoon-icon-illustration-food-vegetable-flat-icon-concept-isolated.jpg?s=612x612&w=0&k=20&c=fyA5bjkDw3-Xv8f8iTHxOvqQ8YguoCiJx0G8wBl9X3c=",
          alt: "Pea",
        },
        { type: "operator" as const, content: ") + (" },
        {
          type: "image" as const,
          content:
            "https://www.shutterstock.com/image-vector/icon-camera-lens-white-background-600nw-99766226.jpg",
          alt: "Lens",
        },
        { type: "operator" as const, content: "- S)" },
        
      ],
    },
    /*
    {
      answer: "LAYOFFS",
      clues: [
        {
          type: "image" as const,
          content:
            "https://static.vecteezy.com/system/resources/previews/044/863/493/non_2x/hawaiian-flower-lei-illustration-vector.jpg",
          alt: "Lei",
        },
        { type: "operator" as const, content: "+ (" },
        {
          type: "image" as const,
          content:
            "https://t3.ftcdn.net/jpg/08/11/10/88/360_F_811108820_KcAMZD8HNZpGaIWNE4CsSKigGrTiRUrR.jpg",
          alt: "Office",
        },
        { type: "operator" as const, content: "-" },
        {
          type: "image" as const,
          content:
            "https://media.istockphoto.com/id/1097363518/vector/vector-illustration-of-cartoon-blue-ice-cubes.jpg?s=612x612&w=0&k=20&c=diCXtXAM-73OoLhNdJJubkak2_YuuLXSKRcJudi1JVY=",
          alt: "Ice",
        },
        { type: "operator" as const, content: ") + S" },
      ],
    },
    */
    
  ],
  hints: [
    "First word: (Word with picture or freeze without the thing you must do for target practice) + (A river crossing without the event for spellers)",
    "Second word: ('Don't ___ on me' (Revolutionary flag motto) without the last two letters) + (a board rider without dog's hair) + ES",
    "Third word: ('Quit doing that!' without a word with soup or shooter) + (part of an eye or camera minus S)",
    //"Fourth word: Hawaiian necklace often made of flowers + one end of some commutes minus the playing surface for curling + S",
  ],
};

export default function App() {
  const [showLandingPage, setShowLandingPage] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [isInstructionsOpen, setIsInstructionsOpen] = useState(false);
  const [isPuzzleComplete, setIsPuzzleComplete] = useState(false);
  const [solveTime, setSolveTime] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [showShareDialog, setShowShareDialog] = useState(false);

  const isTimerActive =
    !showLandingPage &&
    !isPaused &&
    !isInstructionsOpen &&
    !isPuzzleComplete;

  const handlePuzzleComplete = useCallback(() => {
    if (!isPuzzleComplete) {
      setIsPuzzleComplete(true);
      setShowShareDialog(true);
    }
  }, [isPuzzleComplete]);

  const handleUseHint = () => {
    setHintsUsed((prev) =>
      Math.min(prev + 1, puzzleData.hints.length),
    );
  };

  const handleTogglePause = () => {
    if (isPuzzleComplete) return;
    setIsPaused((prev) => !prev);
  };

  const handleStartGame = () => {
    setShowLandingPage(false);
    setIsPaused(false);
    setIsInstructionsOpen(false);
    setIsPuzzleComplete(false);
    setSolveTime(0);
    setHintsUsed(0);
    setShowShareDialog(false);
  };

  const handleInstructionsOpenChange = (open: boolean) => {
    setIsInstructionsOpen(open);
  };

  if (showLandingPage) {
    return <LandingPage onStartGame={handleStartGame} />;
  }

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-orange-50 via-yellow-50 to-pink-50 overflow-hidden">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm shadow-sm flex-shrink-0">
        <div className="max-w-5xl mx-auto px-4 py-2.5">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-primary mb-0.5">
                Decryptions
              </h1>
              <p className="text-xs text-muted-foreground">
                Decode the News, One Puzzle at a Time
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Timer
                isActive={isTimerActive}
                onTimeUpdate={setSolveTime}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleTogglePause}
                disabled={isPuzzleComplete}
                className="shrink-0"
              >
                {isPaused ? (
                  <Play className="w-4 h-4" />
                ) : (
                  <Pause className="w-4 h-4" />
                )}
              </Button>
              <InstructionsDialog onOpenChange={handleInstructionsOpenChange} />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-block px-2.5 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs">
              {puzzleData.category}
            </div>
            <span className="text-xs text-muted-foreground">
              {puzzleData.date}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className={`flex-1 overflow-y-auto overflow-x-hidden transition-all duration-300 ${isInstructionsOpen ? 'blur-sm' : ''}`}>
        <div className="max-w-5xl mx-auto px-4 py-6 min-h-full flex flex-col">
          <div className="mb-4 text-center">
            <h2 className="text-primary mb-0.5">
              Today's Headline
            </h2>
            <p className="text-xs text-muted-foreground">
              Solve the rebus puzzle to reveal the news!
            </p>
          </div>

          <div className="flex items-center justify-center mb-6">
            <RebusPuzzle
              words={puzzleData.words}
              onComplete={handlePuzzleComplete}
              isPaused={isPaused}
              hints={puzzleData.hints}
              onUseHint={handleUseHint}
            />
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
            {isPuzzleComplete && (
              <Button
                onClick={() => setShowShareDialog(true)}
                className="gap-2 bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600"
              >
                Share Results
              </Button>
            )}
          </div>

          {/* Success Message */}
          {isPuzzleComplete && (
            <div className="p-4 bg-white rounded-xl shadow-md text-center border-2 border-green-200 mb-4">
              <p className="text-2xl mb-1">🎉</p>
              <h3 className="text-green-700 mb-1">
                Congratulations!
              </h3>
              <p className="text-sm text-muted-foreground">
                You've decoded today's headline:{" "}
                <span className="text-primary">
                  "{puzzleData.headline}"
                </span>
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Pause Overlay */}
      {isPaused && !isInstructionsOpen && !isPuzzleComplete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-8 shadow-2xl text-center max-w-sm mx-4">
            <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Pause className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-primary mb-2">Game Paused</h2>
            <p className="text-muted-foreground mb-6">
              Take a break! Click below when you're ready to
              continue.
            </p>
            <Button
              onClick={handleTogglePause}
              size="lg"
              className="w-full gap-2 bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600"
            >
              <Play className="w-5 h-5" />
              Resume Game
            </Button>
          </div>
        </div>
      )}

      <ShareDialog
        isOpen={showShareDialog}
        onOpenChange={setShowShareDialog}
        solveTime={solveTime}
        hintsUsed={hintsUsed}
        headline={puzzleData.headline}
      />

      <Toaster richColors position="top-center" />
    </div>
  );
}