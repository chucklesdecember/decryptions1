import React, { useState } from "react";
import { Button } from "./ui/button";

import { Archive } from "lucide-react";
import { AccountMenu } from "./AccountMenu";

interface LandingPageProps {
  puzzleDate: string;
  unavailable?: boolean;
  onStartGame: () => void;
  onOpenArchive: () => void;
}

export function LandingPage({ onStartGame, onOpenArchive, puzzleDate, unavailable }: LandingPageProps) {
  const [logoLoadFailed, setLogoLoadFailed] = useState(false);

  return (
    // min-h (not h) so short / landscape phones scroll instead of clipping the logo off the top.
    <div
      className="relative isolate flex min-h-app w-full flex-col items-center justify-center bg-amber-50 px-4 pb-8 pt-16"
      style={{ backgroundColor: "#fffbea" }}
    >
      {/* Account: log in / sign up, or the signed-in username menu */}
      <div className="absolute right-4 top-4 z-20">
        <AccountMenu className="bg-white/80" />
      </div>

      <div className="relative z-0 flex w-full max-w-sm flex-col items-center text-center">
        {/* Logo */}
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
              <span style={{ fontFamily: "Times New Roman, serif", fontSize: "28px" }}>
                D
              </span>
            </div>
          )}
        </div>

        {/* Title — scales down on narrow screens so it never overflows */}
        <h1
          className="mb-8 text-[clamp(2.75rem,14vw,4rem)] font-normal leading-none text-black"
          style={{ fontFamily: "Times New Roman, serif" }}
        >
          Decryptions
        </h1>

        {/* Play — Connections-style black pill, white label */}
        <div className="relative z-10 mb-6 w-full px-4">
          <Button
            type="button"
            variant="black"
            onClick={onStartGame}
            disabled={unavailable}
            className="relative z-10 h-12 w-full rounded-full border-none bg-black px-6 text-base font-medium text-white shadow-none hover:opacity-90"
          >
            Play
          </Button>
        </div>

        {/* Date + Author */}
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
