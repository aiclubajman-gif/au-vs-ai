'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { CircuitBackground } from '@/components/dashboard/CircuitBackground';
import { ClashBar, type ClashStats } from '@/components/dashboard/ClashBar';
import { ChallengerTable, type ChallengerRow } from '@/components/dashboard/ChallengerTable';

interface EventStatsData {
  totalPlayers: number;
  humanWins: number;
  aiWins: number;
  topScore: number;
  averageScore: number;
  playingNow: number;
}

interface DashboardClientProps {
  initialClash?: ClashStats;
  initialEventStats?: EventStatsData;
  initialChallengers?: ChallengerRow[];
}

export function DashboardClient({
  initialClash = { humanTotal: 0, aiTotal: 0, humanPercentage: 50, aiPercentage: 50 },
  initialEventStats = { totalPlayers: 0, humanWins: 0, aiWins: 0, topScore: 0, averageScore: 0, playingNow: 0 },
  initialChallengers = [],
}: DashboardClientProps) {
  const [clash, setClash] = useState<ClashStats>(initialClash);
  const [eventStats, setEventStats] = useState<EventStatsData>(initialEventStats);
  const [challengers, setChallengers] = useState<ChallengerRow[]>(initialChallengers);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isLive, setIsLive] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;

    async function poll() {
      try {
        const res = await fetch('/api/dashboard/stats');
        const json = await res.json();
        if (mounted && json.ok && json.data) {
          setClash(json.data.clash);
          setEventStats(json.data.eventStats);
          setChallengers(json.data.topChallengers);
          setLastUpdated(new Date());
          setIsLive(true);
        }
      } catch {
        if (mounted) setIsLive(false);
      }
    }

    // Initial poll to ensure live data
    poll();

    // Regular live 5-second polling for TV booth screen
    const interval = setInterval(poll, 5000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="relative min-h-dvh w-full overflow-x-hidden bg-[var(--color-void)] text-white select-none">
      {/* Dynamic Background SVG with Dual Flank Circuits */}
      <CircuitBackground />

      <main className="relative z-10 mx-auto flex min-h-dvh max-w-6xl flex-col justify-between px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {/* =================================================================
            1. TOP HEADER BANNER: "HUMANS vs AI LEADERBOARD"
            ================================================================= */}
        <header className="mx-auto w-full max-w-4xl text-center">
          {/* Subtitle / Live Badge */}
          <div className="mb-2 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-sky-400">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                isLive ? 'bg-emerald-400 shadow-[0_0_10px_#34d399] animate-pulse' : 'bg-amber-400'
              }`}
            />
            <span>AIDA · AJMAN UNIVERSITY · LIVE BOOTH TOURNAMENT</span>
          </div>

          {/* Main Beveled Title Banner */}
          <div
            className="relative mx-auto overflow-hidden rounded-2xl border border-sky-500/40 p-4 sm:rounded-3xl sm:p-6"
            style={{
              background: 'linear-gradient(180deg, #091436 0%, #030818 100%)',
              boxShadow:
                '0 12px 40px rgba(0, 0, 0, 0.7), inset 0 2px 4px rgba(255, 255, 255, 0.25), 0 0 30px rgba(0, 240, 255, 0.2)',
            }}
          >
            {/* Top metallic highlight bar */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-white/20 to-transparent" />

            <h1 className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center font-black tracking-wider uppercase italic">
              {/* HUMANS */}
              <span
                className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl text-[var(--color-human-gold)]"
                style={{
                  textShadow:
                    '0 0 20px rgba(245, 158, 11, 0.7), 0 2px 4px rgba(0, 0, 0, 0.9)',
                }}
              >
                HUMANS
              </span>

              {/* VS */}
              <span
                className="text-xl sm:text-3xl md:text-4xl lg:text-5xl text-sky-400"
                style={{
                  textShadow: '0 0 15px rgba(0, 240, 255, 0.8)',
                }}
              >
                vs
              </span>

              {/* AI LEADERBOARD */}
              <span
                className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl text-white"
                style={{
                  textShadow:
                    '0 0 20px rgba(56, 189, 248, 0.7), 0 2px 4px rgba(0, 0, 0, 0.9)',
                }}
              >
                AI LEADERBOARD
              </span>
            </h1>
          </div>
        </header>

        {/* =================================================================
            2. THE DYNAMIC CLASH BAR
            ================================================================= */}
        <section className="mx-auto my-6 w-full max-w-4xl" aria-label="Humans vs AI Score Battle">
          <ClashBar stats={clash} />
        </section>

        {/* =================================================================
            3. TOP HUMAN CHALLENGERS & TELEMETRY
            ================================================================= */}
        <section className="mx-auto w-full max-w-4xl flex-1">
          <ChallengerTable rows={challengers} />

          {/* Telemetry quick badges below the table */}
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-sky-500/20 bg-[#071333]/70 p-3 text-center backdrop-blur-sm">
              <span className="text-xs uppercase tracking-wider text-slate-400">Total Challengers</span>
              <p className="tabular mt-1 text-xl font-black text-white sm:text-2xl">
                {eventStats.totalPlayers}
              </p>
            </div>

            <div className="rounded-xl border border-amber-500/20 bg-[#1c1206]/70 p-3 text-center backdrop-blur-sm">
              <span className="text-xs uppercase tracking-wider text-amber-300">Human Victories</span>
              <p className="tabular mt-1 text-xl font-black text-amber-400 sm:text-2xl">
                {eventStats.humanWins}
              </p>
            </div>

            <div className="rounded-xl border border-sky-500/20 bg-[#071333]/70 p-3 text-center backdrop-blur-sm">
              <span className="text-xs uppercase tracking-wider text-sky-300">AI Defenses</span>
              <p className="tabular mt-1 text-xl font-black text-sky-400 sm:text-2xl">
                {eventStats.aiWins}
              </p>
            </div>

            <div className="rounded-xl border border-emerald-500/20 bg-[#072418]/70 p-3 text-center backdrop-blur-sm">
              <span className="text-xs uppercase tracking-wider text-emerald-300">Highest Score</span>
              <p className="tabular mt-1 text-xl font-black text-emerald-400 sm:text-2xl">
                {eventStats.topScore}
              </p>
            </div>
          </div>
        </section>

        {/* =================================================================
            4. BOOTH FOOTER / QR CODE PROMPT
            ================================================================= */}
        <footer className="mt-6 flex flex-col items-center justify-between gap-3 border-t border-slate-800/80 pt-4 text-xs text-slate-400 sm:flex-row">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-200">Scan QR Code at Booth to Join:</span>
            <Link
              href="/play"
              className="rounded-lg bg-sky-500/20 px-3 py-1 font-bold text-sky-300 transition-colors hover:bg-sky-500/30"
            >
              Play Challenge →
            </Link>
          </div>

          <div className="tabular text-slate-400 text-xs">
            Auto-refreshing live · Last sync:{' '}
            {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
        </footer>
      </main>
    </div>
  );
}
