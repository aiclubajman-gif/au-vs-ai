import React from 'react';

/**
 * CircuitBackground — 16-Bit Retro Arena Stadium Flanks & Ambience
 *
 * Directly incorporates the extracted 16-bit RPG assets:
 * - Left Flank: `flank-meadow-left.png` with character sprites (`char-boy-redcap`, `char-girl-strawhat`, `char-boy-bluehoodie`).
 * - Right Flank: `flank-circuit-right.png` with monitor robots (`robot-monitor-standing`, `robot-monitor-waving`).
 * - Background: Dark gradient + SVG circuit traces for high contrast and stadium depth.
 */
export function CircuitBackground({ splitPct = 50, className = '' }: { splitPct?: number; className?: string }) {
  return (
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden select-none ${className}`}
      aria-hidden="true"
    >
      {/* Background Ambience Gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#02050e] via-[#050b1e] to-[#01040d]" />

      {/* Subtle CRT Scanline overlay */}
      <div className="absolute inset-0 scanlines opacity-40 z-10" />

      {/* SVG Circuit Grid Traces */}
      <svg className="absolute inset-0 h-full w-full opacity-20" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="stadium-circuit-pat" width="80" height="80" patternUnits="userSpaceOnUse">
            <path
              d="M 0 20 L 30 20 L 40 10 L 80 10 M 0 60 L 25 60 L 40 75 L 80 75 M 30 20 L 30 45 L 50 45 L 50 80 M 60 10 L 60 35 L 75 35"
              fill="none"
              stroke="#00f0ff"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="30" cy="20" r="2" fill="#00f0ff" />
            <circle cx="40" cy="10" r="2" fill="#00f0ff" />
            <circle cx="50" cy="45" r="2" fill="#00f0ff" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#stadium-circuit-pat)" />
      </svg>

      {/* =====================================================================
          LEFT FLANK: RPG MEADOW & HUMAN CHALLENGERS (Desktop >= 1024px)
          ===================================================================== */}
      <div className="absolute bottom-0 left-0 top-0 hidden w-[320px] xl:w-[400px] 2xl:w-[480px] lg:flex flex-col justify-end overflow-hidden z-0">
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/sprites/flank-meadow-left.png"
            alt="Meadow Flank"
            className="pixelated w-full object-contain opacity-85 drop-shadow-[0_0_30px_rgba(0,0,0,0.9)]"
          />

          {/* Character Sprites standing on the cliff */}
          <div className="absolute bottom-24 left-10 flex items-end gap-2">
            {/* Boy with Red Cap */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/sprites/char-boy-redcap.png"
              alt="Boy Redcap"
              className="pixelated h-28 w-auto object-contain animate-float drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]"
            />
            {/* Girl with Straw Hat */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/sprites/char-girl-strawhat.png"
              alt="Girl Strawhat"
              className="pixelated h-24 w-auto object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]"
              style={{ animationDelay: '0.8s' }}
            />
          </div>
        </div>
      </div>

      {/* =====================================================================
          RIGHT FLANK: CYBER CIRCUIT & MONITOR ROBOTS (Desktop >= 1024px)
          ===================================================================== */}
      <div className="absolute bottom-0 right-0 top-0 hidden w-[320px] xl:w-[400px] 2xl:w-[480px] lg:flex flex-col justify-end items-end overflow-hidden z-0">
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/sprites/flank-circuit-right.png"
            alt="Circuit Flank"
            className="pixelated w-full object-contain opacity-85 drop-shadow-[0_0_30px_rgba(0,0,0,0.9)]"
          />

          {/* Robot Sprites on the motherboard */}
          <div className="absolute bottom-24 right-10 flex items-end gap-3">
            {/* Monitor Robot Waving */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/sprites/robot-monitor-waving.png"
              alt="Robot Waving"
              className="pixelated h-28 w-auto object-contain animate-float drop-shadow-[0_4px_12px_rgba(0,240,255,0.4)]"
              style={{ animationDelay: '1.4s' }}
            />
            {/* Monitor Robot Standing */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/sprites/robot-monitor-standing.png"
              alt="Robot Standing"
              className="pixelated h-26 w-auto object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
