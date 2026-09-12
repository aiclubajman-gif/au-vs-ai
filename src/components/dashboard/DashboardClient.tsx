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

    poll();
    const interval = setInterval(poll, 5000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="relative min-h-dvh w-full overflow-hidden bg-[#02050e] text-white select-none">
      {/* High-Voltage Vector Flank Artwork (Crowds & AI Motherboard) */}
      <CircuitBackground />

      <main className="relative z-10 mx-auto flex min-h-dvh max-w-7xl flex-col justify-between px-4 py-5 sm:px-6 lg:px-8">
        {/* =================================================================
            1. TOP STADIUM BANNER: "HUMANS vs AI LEADERBOARD"
            ================================================================= */}
        <header className="mx-auto w-full max-w-4xl text-center">
          <div className="mb-2 flex items-center justify-center gap-2 text-xs font-black uppercase tracking-[0.25em] text-sky-400">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                isLive ? 'bg-emerald-400 shadow-[0_0_12px_#34d399] animate-pulse' : 'bg-amber-400'
              }`}
            />
            <span>AIDA · AJMAN UNIVERSITY · LIVE BOOTH TOURNAMENT</span>
          </div>

          <div
            className="relative mx-auto overflow-hidden rounded-2xl border-[3px] border-[#1e5dd8] px-6 py-3 sm:py-4"
            style={{
              background: 'linear-gradient(180deg, #092a6b 0%, #04143a 50%, #01081a 100%)',
              boxShadow:
                '0 0 25px rgba(30, 93, 216, 0.6), inset 0 2px 4px rgba(255, 255, 255, 0.5), inset 0 -2px 6px rgba(0, 0, 0, 0.8)',
            }}
          >
            <h1 className="flex flex-wrap items-center justify-center gap-x-3 text-center font-black tracking-wider uppercase italic text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-[#ffe600] drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
              HUMANS <span className="text-xl sm:text-3xl md:text-4xl text-white drop-shadow-[0_0_12px_rgba(0,240,255,0.9)]">vs</span> AI LEADERBOARD
            </h1>
          </div>
        </header>

        {/* =================================================================
            2. THE DYNAMIC ANIME CLASH BAR
            ================================================================= */}
        <section className="mx-auto my-4 w-full max-w-5xl" aria-label="Humans vs AI Score Battle">
          <ClashBar stats={clash} />
        </section>

        {/* =================================================================
            3. TOP HUMAN CHALLENGERS TABLE
            ================================================================= */}
        <section className="mx-auto w-full max-w-4xl flex-1">
          <ChallengerTable rows={challengers} />

          {/* Telemetry quick badges below the table */}
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-sky-500/25 bg-[#071333]/70 p-3 text-center backdrop-blur-sm">
              <span className="text-xs uppercase tracking-wider text-slate-400">Total Challengers</span>
              <p className="tabular mt-0.5 text-xl font-black text-white sm:text-2xl">
                {eventStats.totalPlayers}
              </p>
            </div>

            <div className="rounded-xl border border-amber-500/25 bg-[#1c1206]/70 p-3 text-center backdrop-blur-sm">
              <span className="text-xs uppercase tracking-wider text-amber-300">Human Victories</span>
              <p className="tabular mt-0.5 text-xl font-black text-amber-400 sm:text-2xl">
                {eventStats.humanWins}
              </p>
            </div>

            <div className="rounded-xl border border-sky-500/25 bg-[#071333]/70 p-3 text-center backdrop-blur-sm">
              <span className="text-xs uppercase tracking-wider text-sky-300">AI Defenses</span>
              <p className="tabular mt-0.5 text-xl font-black text-sky-400 sm:text-2xl">
                {eventStats.aiWins}
              </p>
            </div>

            <div className="rounded-xl border border-emerald-500/25 bg-[#072418]/70 p-3 text-center backdrop-blur-sm">
              <span className="text-xs uppercase tracking-wider text-emerald-300">Highest Score</span>
              <p className="tabular mt-0.5 text-xl font-black text-emerald-400 sm:text-2xl">
                {eventStats.topScore}
              </p>
            </div>
          </div>
        </section>

        {/* =================================================================
            4. BOOTH FOOTER / QR CODE LINK
            ================================================================= */}
        <footer className="mt-4 flex flex-col items-center justify-between gap-2 border-t border-slate-800/80 pt-3 text-xs text-slate-400 sm:flex-row">
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
