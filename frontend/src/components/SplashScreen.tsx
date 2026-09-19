"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";

interface SplashScreenProps {
  onFinish?: () => void;
  autoHideDuration?: number;
}

export default function SplashScreen({
  onFinish,
  autoHideDuration = 2200,
}: SplashScreenProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => {
      setIsFading(true);
    }, autoHideDuration - 400);

    const finishTimer = setTimeout(() => {
      setIsVisible(false);
      if (onFinish) onFinish();
    }, autoHideDuration);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(finishTimer);
    };
  }, [autoHideDuration, onFinish]);

  if (!isVisible) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background transition-opacity duration-500 ${
        isFading ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      <div className="relative flex flex-col items-center justify-center">
        {/* Pulsing subtle glow backdrop */}
        <div className="absolute w-52 h-52 rounded-full bg-primary/10 blur-2xl animate-pulse pointer-events-none" />

        {/* Loading Dial / Speedometer Icon from loading screen.png */}
        <div className="relative w-28 h-28 flex items-center justify-center mb-6">
          <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-spin" style={{ animationDuration: '4s' }} />
          <img
            src="/loading screen.png"
            alt="OPDQueue Loading Dial"
            className="w-24 h-24 object-contain drop-shadow-md"
          />
        </div>

        {/* Brand Name & Tagline */}
        <div className="flex flex-col items-center text-center">
          <h1 className="font-headline-lg text-headline-lg font-bold text-primary tracking-tight">
            OPDQueue
          </h1>
          <p className="font-label-sm text-label-sm text-secondary uppercase tracking-widest mt-1">
            Clinical Queue Intelligence
          </p>
        </div>

        {/* Progress Bar & Telemetry Status */}
        <div className="mt-8 flex flex-col items-center gap-2 w-64">
          <div className="w-full bg-surface-container-highest h-1.5 rounded-full overflow-hidden">
            <div className="bg-primary h-full rounded-full animate-pulse w-3/4 transition-all duration-1000" />
          </div>
          <span className="font-body-sm text-body-sm text-on-surface-variant flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
            Synchronizing Clinical Engine...
          </span>
        </div>
      </div>
    </div>
  );
}
