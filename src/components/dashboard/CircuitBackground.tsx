import React from 'react';

/**
 * CircuitBackground — Self-Contained Split Background & Circuit Texture
 *
 * Implements §2.2 & §2.3:
 * - Single inline SVG <pattern> for the circuit traces (< 2 KB).
 * - Inline SVG silhouettes for human actions and AI microchips.
 * - Zero external image requests.
 */
export function CircuitBackground({ splitPct = 66, className = '' }: { splitPct?: number; className?: string }) {
  return (
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden select-none ${className}`}
      aria-hidden="true"
    >
      {/* SVG Pattern Definitions */}
      <svg className="hidden" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="react-circuit-pat" width="80" height="80" patternUnits="userSpaceOnUse">
            <path
              d="M 0 20 L 30 20 L 40 10 L 80 10 M 0 60 L 25 60 L 40 75 L 80 75 M 30 20 L 30 45 L 50 45 L 50 80 M 60 10 L 60 35 L 75 35"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="30" cy="20" r="3" fill="currentColor" />
            <circle cx="40" cy="10" r="2.5" fill="currentColor" />
            <circle cx="50" cy="45" r="3" fill="currentColor" />
            <circle cx="25" cy="60" r="2.5" fill="currentColor" />
            <circle cx="40" cy="75" r="3" fill="currentColor" />
          </pattern>

          <symbol id="sym-human-runner" viewBox="0 0 100 120">
            <circle cx="50" cy="18" r="13" fill="#ffffff" />
            <path d="M 45 34 C 36 44, 25 60, 15 82 L 27 86 C 33 70, 40 56, 48 50 L 62 68 L 84 78 L 78 64 L 62 58 L 52 42 L 66 36 C 76 42, 90 50, 100 54 L 100 42 C 90 38, 78 30, 68 26 Z" fill="#ffffff" />
            <path d="M 36 74 L 18 116 L 32 118 L 50 84 Z" fill="#ffffff" />
            <path d="M 60 72 L 78 112 L 96 108 L 76 92 Z" fill="#ffffff" />
          </symbol>

          <symbol id="sym-human-cheer" viewBox="0 0 100 120">
            <circle cx="50" cy="20" r="13" fill="#ffffff" />
            <path d="M 50 35 L 42 70 L 26 118 L 40 118 L 52 78 L 60 118 L 74 118 L 58 70 Z" fill="#ffffff" />
            <path d="M 50 38 L 18 10 L 26 4 L 50 28 L 74 4 L 82 10 Z" fill="#ffffff" />
          </symbol>

          <symbol id="sym-human-jump" viewBox="0 0 100 120">
            <circle cx="50" cy="16" r="12" fill="#ffffff" />
            <path d="M 50 30 C 44 40, 32 60, 20 80 L 32 84 C 40 70, 48 54, 52 48 L 68 62 L 90 70 L 86 58 L 70 52 L 60 38 Z" fill="#ffffff" />
            <path d="M 38 72 L 20 112 L 34 114 L 50 82 Z" fill="#ffffff" />
            <path d="M 62 70 L 80 110 L 96 106 L 78 88 Z" fill="#ffffff" />
          </symbol>

          <symbol id="sym-ai-chip" viewBox="0 0 100 100">
            <rect x="15" y="15" width="70" height="70" rx="14" fill="#06122d" stroke="#00f0ff" strokeWidth="3" />
            <rect x="25" y="25" width="50" height="50" rx="8" fill="#0b2259" stroke="#38bdf8" strokeWidth="1.5" />
            <line x1="5" y1="35" x2="15" y2="35" stroke="#00f0ff" strokeWidth="3" />
            <line x1="5" y1="50" x2="15" y2="50" stroke="#00f0ff" strokeWidth="3" />
            <line x1="5" y1="65" x2="15" y2="65" stroke="#00f0ff" strokeWidth="3" />
            <line x1="85" y1="35" x2="95" y2="35" stroke="#00f0ff" strokeWidth="3" />
            <line x1="85" y1="50" x2="95" y2="50" stroke="#00f0ff" strokeWidth="3" />
            <line x1="85" y1="65" x2="95" y2="65" stroke="#00f0ff" strokeWidth="3" />
            <line x1="35" y1="5" x2="35" y2="15" stroke="#00f0ff" strokeWidth="3" />
            <line x1="50" y1="5" x2="50" y2="15" stroke="#00f0ff" strokeWidth="3" />
            <line x1="65" y1="5" x2="65" y2="15" stroke="#00f0ff" strokeWidth="3" />
            <line x1="35" y1="85" x2="35" y2="95" stroke="#00f0ff" strokeWidth="3" />
            <line x1="50" y1="85" x2="50" y2="95" stroke="#00f0ff" strokeWidth="3" />
            <line x1="65" y1="85" x2="65" y2="95" stroke="#00f0ff" strokeWidth="3" />
            <text x="50" y="58" fill="#00f0ff" fontFamily="sans-serif" fontSize="24" fontWeight="900" textAnchor="middle" letterSpacing="1">AI</text>
          </symbol>
        </defs>
      </svg>

      {/* Split Background Layer */}
      <div className="absolute inset-0 flex">
        <div
          className="relative h-full transition-[width] duration-75"
          style={{
            width: `${splitPct}%`,
            background: 'linear-gradient(135deg, #4a1208 0%, #1a0500 100%)',
          }}
        >
          <svg className="absolute inset-0 h-full w-full opacity-15 text-amber-600">
            <rect width="100%" height="100%" fill="url(#react-circuit-pat)" />
          </svg>
        </div>

        <div
          className="relative h-full flex-1"
          style={{
            background: 'linear-gradient(225deg, #0b1240 0%, #05081f 100%)',
          }}
        >
          <svg className="absolute inset-0 h-full w-full opacity-15 text-blue-600">
            <rect width="100%" height="100%" fill="url(#react-circuit-pat)" />
          </svg>
        </div>
      </div>

      {/* Side Iconography (SVGs) */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Human Silhouettes */}
        <svg
          className="absolute top-[12%] left-[2%] h-[75%] w-[clamp(140px,26vw,360px)] opacity-85 transition-opacity duration-300 max-sm:opacity-25 max-[380px]:hidden"
          style={{ filter: 'drop-shadow(0 0 10px rgba(255, 140, 26, 0.6))' }}
          viewBox="0 0 320 400"
        >
          <use href="#sym-human-cheer" x="10" y="20" width="60" height="72" opacity="0.7" />
          <use href="#sym-human-runner" x="70" y="10" width="65" height="78" opacity="0.95" />
          <use href="#sym-human-jump" x="140" y="30" width="55" height="66" opacity="0.8" />
          <use href="#sym-human-runner" x="20" y="110" width="70" height="84" opacity="0.9" />
          <use href="#sym-human-cheer" x="100" y="100" width="80" height="96" opacity="1.0" />
          <use href="#sym-human-jump" x="180" y="120" width="60" height="72" opacity="0.75" />
          <use href="#sym-human-cheer" x="0" y="220" width="65" height="78" opacity="0.8" />
          <use href="#sym-human-runner" x="75" y="210" width="75" height="90" opacity="0.9" />
          <use href="#sym-human-jump" x="160" y="230" width="55" height="66" opacity="0.65" />
          <use href="#sym-human-cheer" x="40" y="310" width="60" height="72" opacity="0.75" />
          <use href="#sym-human-runner" x="110" y="300" width="70" height="84" opacity="0.85" />
          <use href="#sym-human-jump" x="190" y="320" width="50" height="60" opacity="0.6" />
        </svg>

        {/* AI Microchips */}
        <svg
          className="absolute top-[12%] right-[2%] h-[75%] w-[clamp(140px,26vw,360px)] opacity-85 transition-opacity duration-300 max-sm:opacity-25 max-[380px]:hidden"
          style={{ filter: 'drop-shadow(0 0 10px rgba(0, 240, 255, 0.6))' }}
          viewBox="0 0 320 400"
        >
          <use href="#sym-ai-chip" x="110" y="140" width="120" height="120" opacity="1.0" />
          <use href="#sym-ai-chip" x="30" y="40" width="65" height="65" opacity="0.85" />
          <use href="#sym-ai-chip" x="210" y="30" width="60" height="60" opacity="0.75" />
          <use href="#sym-ai-chip" x="20" y="260" width="70" height="70" opacity="0.8" />
          <use href="#sym-ai-chip" x="220" y="270" width="65" height="65" opacity="0.85" />
        </svg>
      </div>
    </div>
  );
}
