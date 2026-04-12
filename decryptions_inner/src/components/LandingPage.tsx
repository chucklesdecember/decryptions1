import React, { useState } from "react";
import { Button } from "./ui/button";

interface LandingPageProps {
  onStartGame: () => void;
}

export function LandingPage({ onStartGame }: LandingPageProps) {
  const [logoLoadFailed, setLogoLoadFailed] = useState(false);

  return (
    <div
      className="h-screen w-screen flex items-center justify-center bg-amber-50"
      style={{ backgroundColor: "#fffbea" }}
    >
      <div className="flex flex-col items-center text-center">
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

        {/* Play Button */}
        <div className="mb-6">
          <Button
            onClick={onStartGame}
            className="bg-black hover:bg-gray-800 text-[#fffbea] px-10 py-3 rounded-full text-lg transition-colors"
          >
            Play
          </Button>
        </div>

        {/* Date + Author */}
        <div className="text-sm text-gray-700">
          <p className="font-bold">April 13, 2026</p>
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
        </div>
      </div>
    </div>
  );
}
