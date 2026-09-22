import React, { useState } from "react";
import { Button } from "./ui/button";
import { Archive } from "lucide-react";
import { AccountMenu } from "./AccountMenu";

interface LandingPageProps {
  puzzleDate: string;
  playLabel: string;
  unavailable?: boolean;
  onStartGame: () => void;
  onOpenArchive: () => void;
  onStats?: () => void;
}

export function LandingPage({ onStartGame, onOpenArchive, onStats, puzzleDate, playLabel, unavailable }: LandingPageProps) {
  const [logoLoadFailed, setLogoLoadFailed] = useState(false);

  return (
    <div
      className="relative isolate flex min-h-app w-full flex-col items-center justify-center bg-amber-50 px-4 py-8"
      style={{ backgroundColor: "#fffbea" }}
    >
      <div className="relative z-0 flex w-full max-w-sm flex-col items-center text-center">
        <div className="mb-6">
          {!logoLoadFailed ? (
            <img
              src="/DecryptionsLogo.png"
              alt="Decryptions Logo"
              className="mx-auto h-auto w-[min(300px,80vw)] object-contain"
              onError={() => setLogoLoadFailed(true)}
            />
          ) : (
            <div className="mx-auto flex h-[220px] w-[220px] items-center justify-center rounded-full border-2 border-black">
              <span style={{ fontFamily: "Times New Roman, serif", fontSize: "28px" }}>D</span>
            </div>
          )}
        </div>

        <h1
          className="mb-8 text-[clamp(2.75rem,14vw,4rem)] font-normal leading-none text-black"
          style={{ fontFamily: "Times New Roman, serif" }}
        >
          Decryptions
        </h1>

        <div className="relative z-10 w-full px-4">
          <Button
            type="button"
            onClick={onStartGame}
            disabled={unavailable}
            className="relative z-10 h-13 w-full rounded-full bg-black px-6 text-base font-semibold text-white shadow-md hover:bg-gray-800 hover:text-white"
          >
            {playLabel}
          </Button>
        </div>

        <div className="relative z-10 mb-6 mt-3 w-full px-4">
          <AccountMenu prominent onAccountReady={onStartGame} onStats={onStats} className="h-10 w-full rounded-full border-black/20 bg-white/70 px-6 text-sm font-medium text-black hover:bg-white" />
        </div>

        <div className="text-sm text-gray-700">
          <p className="font-bold">{puzzleDate}</p>
          <p>By Charlie November</p>
          <p className="break-words">
            Contact:{" "}
            <a
              href="mailto:charlie.november@duke.edu"
              className="text-black underline decoration-black/40 underline-offset-2 hover:decoration-black"
            >
              charlie.november@duke.edu
            </a>
          </p>
          <p className="mt-2">
            Instagram:{" "}
            <a
              href="https://www.instagram.com/decryptions.official/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-black underline decoration-black/40 underline-offset-2 hover:decoration-black"
            >
              @decryptions.official
            </a>
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={onOpenArchive}
            className="mt-5 h-11 gap-2 rounded-full border-black/20 px-6 text-base hover:bg-black/5"
          >
            <Archive className="h-4 w-4" />
            Archive
          </Button>
        </div>
      </div>
    </div>
  );
}
