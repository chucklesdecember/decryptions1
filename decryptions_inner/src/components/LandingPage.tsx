import React, { useState } from "react";
import { Button } from "./ui/button";
import { getCurrentPuzzle } from "../data/puzzles";
import { Archive } from "lucide-react";

interface LandingPageProps {
  onStartGame: () => void;
  onOpenArchive: () => void;
}

export function LandingPage({ onStartGame, onOpenArchive }: LandingPageProps) {
  const puzzleDate = getCurrentPuzzle().date;
  const [logoLoadFailed, setLogoLoadFailed] = useState(false);

  return (
    <div
      className="relative isolate h-screen w-screen flex items-center justify-center bg-amber-50"
      style={{ backgroundColor: "#fffbea" }}
    >
      <div className="relative z-0 flex flex-col items-center text-center">
        {/* Logo */}
        <div className="mb-6">
          {!logoLoadFailed ? (
            <img
              src="/DecryptionsLogo.png"
              alt="Decryptions Logo"
              className="mx-auto object-contain"
              style={{ maxWidth: "300px", maxHeight: "300px", width: "100%", height: "auto" }}
              onError={() => setLogoLoadFailed(true)}
            />
          ) : (
            <div className="mx-auto w-[220px] h-[220px] rounded-full border-2 border-black flex items-center justify-center">
              <span style={{ fontFamily: "Times New Roman, serif", fontSize: "28px" }}>
                D
              </span>
            </div>
          )}
        </div>

        {/* Title */}
        <h1
          className="mb-8"
          style={{
            fontFamily: "Times New Roman, serif",
            fontSize: "64px",
            fontWeight: "normal",
            color: "black",
          }}
        >
          Decryptions
        </h1>

        {/* Play — Connections-style black pill, white label */}
        <div className="relative z-10 mb-6 w-full max-w-sm px-4">
          <Button
            type="button"
            variant="black"
            onClick={onStartGame}
            className="relative z-10 w-full rounded-full border-none bg-black px-6 py-4 text-base font-medium text-white shadow-none hover:opacity-90"
          >
            Play
          </Button>
        </div>

        {/* Date + Author */}
        <div className="text-sm text-gray-700">
          <p className="font-bold">{puzzleDate}</p>
          <p>By Charlie November</p>
          <p>
            Contact:{" "}
            <a
              href="mailto:charlie.november@duke.edu"
              className="text-black underline decoration-black/40 underline-offset-2 hover:decoration-black"
            >
              charlie.november@duke.edu
            </a>
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={onOpenArchive}
            className="mt-5 rounded-full px-8 py-3 text-base gap-2 border-black/20 hover:bg-black/5"
          >
            <Archive className="h-4 w-4" />
            Archive
          </Button>
        </div>
      </div>
    </div>
  );
}
