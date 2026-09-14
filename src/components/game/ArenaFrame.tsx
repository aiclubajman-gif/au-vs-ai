'use client';

import React, { type ReactNode } from 'react';

interface ArenaFrameProps {
  children: ReactNode;
  roundName?: string;
  roundBadge?: string;
  leftMascot?: string;
  leftMascotAlt?: string;
  rightMascot?: string;
  rightMascotAlt?: string;
  maxWidth?: string;
  className?: string;
  flankTheme?: 'default' | 'human-win' | 'ai-win';
}

/**
 * ArenaFrame — 16-Bit Retro Arcade Responsive Stadium Shell
 *
 * Renders:
 * - Desktop (>= 1024px): 16-bit RPG Meadow Flank on the left & Cyber Circuit Flank on the right.
 * - Mobile (< 1024px): Seamless 9:16 vertical circuit texture backdrop, min-h-dvh, zero overflow.
 */
export function ArenaFrame({
  children,
  roundName,
  roundBadge,
  leftMascot = '/sprites/char-boy-redcap.png',
  leftMascotAlt = 'Human Team Challenger',
  rightMascot = '/sprites/robot-monitor-standing.png',
  rightMascotAlt = 'AI Opponent',
  maxWidth = 'max-w-md',
  className = '',
  flankTheme = 'default',
}: ArenaFrameProps) {
  return (
    <div className="relative min-h-dvh w-full overflow-x-hidden bg-[#02050e] text-white select-none">
      {/* Background Ambience / Mobile Texture */}
      <div
        className="pointer-events-none absolute inset-0 bg-mobile-circuit-pattern opacity-40 lg:opacity-20"
        aria-hidden="true"
      />

      {/* Subtle Scanlines overlay for arcade CRT feel */}
      <div className="pointer-events-none absolute inset-0 scanlines opacity-50" aria-hidden="true" />

      {/* Desktop Left Flank — RPG Meadow & Human Team */}
      <aside
        className="pointer-events-none absolute bottom-0 left-0 top-0 hidden w-[280px] xl:w-[340px] 2xl:w-[420px] lg:flex flex-col justify-between overflow-hidden p-6 z-0"
        aria-hidden="true"
      >
        <div className="flex items-center gap-2">
          <span className="rounded-md border border-amber-400/40 bg-amber-500/20 px-2.5 py-1 font-pixel text-[10px] uppercase tracking-wider text-amber-300 shadow-[0_0_12px_rgba(255,190,11,0.3)]">
            TEAM HUMAN
          </span>
        </div>

        {/* Meadow Artwork & Human Mascot */}
        <div className="relative mt-auto">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/sprites/flank-meadow-left.png"
            alt="Meadow RPG Flank"
            className="pixelated w-full object-contain opacity-75 drop-shadow-[0_0_25px_rgba(0,0,0,0.8)]"
          />
          {leftMascot && (
            <div className="absolute -top-12 left-8 animate-float">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={leftMascot}
                alt={leftMascotAlt}
                className="pixelated h-28 w-auto object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.9)]"
              />
            </div>
          )}
        </div>
      </aside>

      {/* Desktop Right Flank — Cyber Circuit & AI Opponent */}
      <aside
        className="pointer-events-none absolute bottom-0 right-0 top-0 hidden w-[280px] xl:w-[340px] 2xl:w-[420px] lg:flex flex-col justify-between items-end overflow-hidden p-6 z-0"
        aria-hidden="true"
      >
        <div className="flex items-center gap-2">
          <span className="rounded-md border border-cyan-400/40 bg-cyan-500/20 px-2.5 py-1 font-pixel text-[10px] uppercase tracking-wider text-cyan-300 shadow-[0_0_12px_rgba(0,240,255,0.3)]">
            TEAM AI
          </span>
        </div>

        {/* Circuit Board Artwork & AI Mascot */}
        <div className="relative mt-auto">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/sprites/flank-circuit-right.png"
            alt="Cyber Circuit Flank"
            className="pixelated w-full object-contain opacity-75 drop-shadow-[0_0_25px_rgba(0,0,0,0.8)]"
          />
          {rightMascot && (
            <div className="absolute -top-12 right-8 animate-float" style={{ animationDelay: '1.2s' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={rightMascot}
                alt={rightMascotAlt}
                className="pixelated h-28 w-auto object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.9)]"
              />
            </div>
          )}
        </div>
      </aside>

      {/* Center Interactive Column */}
      <div className={`relative z-10 mx-auto flex min-h-dvh w-full ${maxWidth} flex-col justify-between px-4 py-5 sm:px-6 ${className}`}>
        {children}
      </div>
    </div>
  );
}
