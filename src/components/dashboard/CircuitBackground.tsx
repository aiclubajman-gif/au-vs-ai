import React from 'react';

/**
 * CircuitBackground — Dual-flank vector circuit traces matching the mockup.
 *
 * Left: Glowing golden-amber circuit traces & human runner/victory silhouettes.
 * Right: Glowing electric-blue circuit traces & AI microprocessor chip nodes.
 *
 * Built as pure resolution-independent SVG with zero download overhead.
 */
export function CircuitBackground({ className = '' }: { className?: string }) {
  return (
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden select-none ${className}`}
      aria-hidden="true"
    >
      {/* Ambient background glows */}
      <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-[var(--color-human-orange)]/15 blur-[120px]" />
      <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-[var(--color-human-gold)]/10 blur-[120px]" />
      <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-[var(--color-ai-cyan)]/15 blur-[120px]" />
      <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-[var(--color-ai-blue)]/15 blur-[120px]" />

      {/* SVG Circuit Canvas */}
      <svg
        className="h-full w-full opacity-60 transition-opacity duration-1000"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid slice"
        viewBox="0 0 1440 900"
      >
        <defs>
          {/* Gradients */}
          <linearGradient id="humanCircuitGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#ea580c" stopOpacity="0.3" />
          </linearGradient>

          <linearGradient id="aiCircuitGrad" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#00f0ff" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#1d4ed8" stopOpacity="0.3" />
          </linearGradient>

          <filter id="humanGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          <filter id="aiGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* LEFT FLANK — HUMAN CIRCUITS (AMBER / ORANGE) */}
        <g stroke="url(#humanCircuitGrad)" strokeWidth="2" fill="none" className="animate-circuit-pulse">
          {/* Circuit Traces */}
          <path d="M 0 120 L 140 120 L 220 200 L 220 320 L 160 380 L 160 480" />
          <path d="M 0 240 L 90 240 L 150 300 L 150 420 L 240 510 L 240 680 L 180 740 L 0 740" />
          <path d="M 0 420 L 70 420 L 110 460 L 110 580 L 50 640 L 0 640" />
          <path d="M 0 820 L 120 820 L 190 750 L 280 750 L 320 710" />

          {/* Node Terminal Dots */}
          <circle cx="220" cy="200" r="4" fill="#f59e0b" filter="url(#humanGlow)" />
          <circle cx="160" cy="480" r="5" fill="#ea580c" filter="url(#humanGlow)" />
          <circle cx="240" cy="680" r="4" fill="#f59e0b" filter="url(#humanGlow)" />
          <circle cx="320" cy="710" r="5" fill="#f59e0b" filter="url(#humanGlow)" />
          <circle cx="110" cy="580" r="4" fill="#ea580c" filter="url(#humanGlow)" />
        </g>

        {/* HUMAN SILHOUETTES (Cheering & Running) */}
        <g fill="#f59e0b" filter="url(#humanGlow)" opacity="0.85">
          {/* Runner 1 */}
          <g transform="translate(60, 260) scale(0.9)">
            <circle cx="24" cy="8" r="7" />
            <path d="M 24 16 C 18 22, 10 32, 6 46 L 14 48 C 18 38, 22 30, 26 26 L 34 38 L 46 44 L 43 36 L 34 32 L 28 22 L 36 18 C 42 22, 50 26, 56 28 L 58 20 C 52 18, 44 14, 38 12 Z" />
            <path d="M 18 42 L 8 68 L 16 70 L 26 48 Z" />
            <path d="M 32 40 L 42 62 L 54 60 L 42 52 L 36 38 Z" />
          </g>

          {/* Celebrator / Hands Up 2 */}
          <g transform="translate(130, 200) scale(0.85)">
            <circle cx="20" cy="8" r="6.5" />
            <path d="M 20 16 L 16 38 L 8 68 L 16 68 L 22 42 L 28 68 L 36 68 L 28 38 Z" />
            <path d="M 20 18 L 4 6 L 8 2 L 20 14 L 32 2 L 36 6 Z" />
          </g>

          {/* Runner 3 */}
          <g transform="translate(45, 410) scale(0.95)">
            <circle cx="20" cy="8" r="6.5" />
            <path d="M 18 16 C 14 24, 8 36, 4 48 L 12 50 C 16 40, 20 30, 22 24 L 28 34 L 38 42 L 42 36 L 32 30 L 26 22 L 32 16 Z" />
            <path d="M 16 44 L 6 70 L 14 70 L 22 48 Z" />
            <path d="M 26 40 L 36 64 L 46 62 L 34 52 Z" />
          </g>

          {/* Cheering Group Silhouette */}
          <g transform="translate(115, 360) scale(0.75)">
            <circle cx="16" cy="8" r="6" />
            <path d="M 16 16 L 12 36 L 4 64 L 12 64 L 18 40 L 24 64 L 32 64 L 24 36 Z" />
            <path d="M 16 18 L 2 8 L 6 4 L 16 14 L 26 4 L 30 8 Z" />
          </g>
        </g>

        {/* RIGHT FLANK — AI CIRCUITS & CHIPS (ELECTRIC CYAN / BLUE) */}
        <g stroke="url(#aiCircuitGrad)" strokeWidth="2" fill="none" className="animate-circuit-pulse">
          {/* Circuit Traces */}
          <path d="M 1440 120 L 1300 120 L 1220 200 L 1220 320 L 1280 380 L 1280 480" />
          <path d="M 1440 240 L 1350 240 L 1290 300 L 1290 420 L 1200 510 L 1200 680 L 1260 740 L 1440 740" />
          <path d="M 1440 420 L 1370 420 L 1330 460 L 1330 580 L 1390 640 L 1440 640" />
          <path d="M 1440 820 L 1320 820 L 1250 750 L 1160 750 L 1120 710" />

          {/* Node Terminal Dots */}
          <circle cx="1220" cy="200" r="4" fill="#00f0ff" filter="url(#aiGlow)" />
          <circle cx="1280" cy="480" r="5" fill="#2563eb" filter="url(#aiGlow)" />
          <circle cx="1200" cy="680" r="4" fill="#00f0ff" filter="url(#aiGlow)" />
          <circle cx="1120" cy="710" r="5" fill="#00f0ff" filter="url(#aiGlow)" />
          <circle cx="1330" cy="580" r="4" fill="#2563eb" filter="url(#aiGlow)" />
        </g>

        {/* AI MICROPROCESSOR CHIPS */}
        {/* Main Central-Right AI Chip */}
        <g transform="translate(1260, 310)" filter="url(#aiGlow)">
          {/* Chip Body */}
          <rect
            x="0"
            y="0"
            width="80"
            height="80"
            rx="12"
            fill="#09132e"
            stroke="#00f0ff"
            strokeWidth="3"
          />
          {/* Inner Core */}
          <rect
            x="12"
            y="12"
            width="56"
            height="56"
            rx="8"
            fill="#0f245c"
            stroke="#38bdf8"
            strokeWidth="1.5"
          />
          {/* Pin Legs */}
          <line x1="-8" y1="20" x2="0" y2="20" stroke="#00f0ff" strokeWidth="2.5" />
          <line x1="-8" y1="36" x2="0" y2="36" stroke="#00f0ff" strokeWidth="2.5" />
          <line x1="-8" y1="52" x2="0" y2="52" stroke="#00f0ff" strokeWidth="2.5" />
          <line x1="-8" y1="68" x2="0" y2="68" stroke="#00f0ff" strokeWidth="2.5" />

          <line x1="80" y1="20" x2="88" y2="20" stroke="#00f0ff" strokeWidth="2.5" />
          <line x1="80" y1="36" x2="88" y2="36" stroke="#00f0ff" strokeWidth="2.5" />
          <line x1="80" y1="52" x2="88" y2="52" stroke="#00f0ff" strokeWidth="2.5" />
          <line x1="80" y1="68" x2="88" y2="68" stroke="#00f0ff" strokeWidth="2.5" />

          <line x1="20" y1="-8" x2="20" y2="0" stroke="#00f0ff" strokeWidth="2.5" />
          <line x1="40" y1="-8" x2="40" y2="0" stroke="#00f0ff" strokeWidth="2.5" />
          <line x1="60" y1="-8" x2="60" y2="0" stroke="#00f0ff" strokeWidth="2.5" />

          <line x1="20" y1="80" x2="20" y2="88" stroke="#00f0ff" strokeWidth="2.5" />
          <line x1="40" y1="80" x2="40" y2="88" stroke="#00f0ff" strokeWidth="2.5" />
          <line x1="60" y1="80" x2="60" y2="88" stroke="#00f0ff" strokeWidth="2.5" />

          {/* AI Label */}
          <text
            x="40"
            y="49"
            fill="#00f0ff"
            fontSize="26"
            fontFamily="sans-serif"
            fontWeight="900"
            letterSpacing="1"
            textAnchor="middle"
          >
            AI
          </text>
        </g>

        {/* Satellite Microchip 1 */}
        <g transform="translate(1360, 220) scale(0.65)" filter="url(#aiGlow)">
          <rect x="0" y="0" width="60" height="60" rx="8" fill="#09132e" stroke="#00f0ff" strokeWidth="2" />
          <text x="30" y="38" fill="#00f0ff" fontSize="20" fontWeight="900" textAnchor="middle">AI</text>
        </g>

        {/* Satellite Microchip 2 */}
        <g transform="translate(1200, 220) scale(0.6)" filter="url(#aiGlow)">
          <rect x="0" y="0" width="60" height="60" rx="8" fill="#09132e" stroke="#00f0ff" strokeWidth="2" />
          <text x="30" y="38" fill="#00f0ff" fontSize="20" fontWeight="900" textAnchor="middle">AI</text>
        </g>

        {/* Satellite Microchip 3 */}
        <g transform="translate(1240, 440) scale(0.6)" filter="url(#aiGlow)">
          <rect x="0" y="0" width="60" height="60" rx="8" fill="#09132e" stroke="#00f0ff" strokeWidth="2" />
          <text x="30" y="38" fill="#00f0ff" fontSize="20" fontWeight="900" textAnchor="middle">AI</text>
        </g>

        {/* Satellite Microchip 4 */}
        <g transform="translate(1360, 430) scale(0.65)" filter="url(#aiGlow)">
          <rect x="0" y="0" width="60" height="60" rx="8" fill="#09132e" stroke="#00f0ff" strokeWidth="2" />
          <text x="30" y="38" fill="#00f0ff" fontSize="20" fontWeight="900" textAnchor="middle">AI</text>
        </g>
      </svg>
    </div>
  );
}
