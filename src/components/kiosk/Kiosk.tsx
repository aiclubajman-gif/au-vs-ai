'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatedSprite, Wordmark } from '@/components/px';
import { ClashBeam } from '@/components/game/ClashBeam';
import { avatarFor, playerLabel } from '@/components/home/TopChallengers';
import type { KioskData, KioskRow } from '@/app/api/kiosk/route';
import { CLUB } from '@/lib/club';

type PanelId = 'video' | 'game' | 'prizes' | 'board';

interface Panel {
  id: PanelId;
  seconds: number;
}

const ATTRACT: Panel[] = [
  { id: 'video', seconds: 80 },
  { id: 'game', seconds: 22 },
  { id: 'prizes', seconds: 18 },
];

const LIVE: Panel[] = [
  { id: 'board', seconds: 75 },
  { id: 'prizes', seconds: 15 },
  { id: 'board', seconds: 75 },
  { id: 'game', seconds: 15 },
  { id: 'board', seconds: 75 },
  { id: 'video', seconds: 80 },
];

const PANEL_LABEL: Record<PanelId, string> = {
  video: 'Now showing · RegWiz, built by AIDA',
  game: 'Humans vs AI · the 60 second challenge',
  prizes: 'Two ChatGPT Plus subscriptions to win',
  board: 'Live leaderboard',
};

const POLL_MS = 8000;
const RELOAD_MS = 30 * 60 * 1000;
const SPLASH_MS = 6500;

const EMPTY: KioskData = {
  live: false,
  totalPlayers: 0,
  humanWins: 0,
  aiWins: 0,
  playingNow: 0,
  topScore: 0,
  mode: 'name_only',
  rows: [],
  updatedAt: '',
};

export function Kiosk({ siteUrl, qr, qrWhatsapp }: { siteUrl: string; qr: string; qrWhatsapp: string }) {
  const [data, setData] = useState<KioskData>(EMPTY);
  const [forced, setForced] = useState<'attract' | 'live' | null>(null);
  const [cursor, setCursor] = useState({ mode: 'attract', index: 0 });
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [splash, setSplash] = useState<KioskRow | null>(null);
  const [wipe, setWipe] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const leaderRef = useRef<string | null>(null);
  const hideTimer = useRef<number | null>(null);

  const live = forced ? forced === 'live' : data.live;
  const playlist = live ? LIVE : ATTRACT;
  const modeKey = live ? 'live' : 'attract';
  const index = cursor.mode === modeKey ? cursor.index : 0;
  const panel = playlist[index % playlist.length];

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/kiosk', { cache: 'no-store' });
        const json = await res.json();
        if (!cancelled && json?.ok) setData(json.data as KioskData);
      } catch {}
    };
    load();
    const t = setInterval(load, POLL_MS);
    const r = setTimeout(() => window.location.reload(), RELOAD_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
      clearTimeout(r);
    };
  }, []);

  useEffect(() => {
    const top = data.rows[0];
    const key = top ? `${top.display_name}-${top.masked_id_suffix}-${top.total_score}` : null;
    if (leaderRef.current !== null && key && key !== leaderRef.current) {
      setSplash(top);
      const t = setTimeout(() => setSplash(null), SPLASH_MS);
      leaderRef.current = key;
      return () => clearTimeout(t);
    }
    leaderRef.current = key;
  }, [data.rows]);

  const busy = useRef(false);
  const go = useCallback(
    (delta: number) => {
      if (busy.current) return;
      busy.current = true;
      setWipe((w) => w + 1);
      window.setTimeout(() => {
        setCursor((c) => ({ mode: modeKey, index: ((c.mode === modeKey ? c.index : 0) + delta + playlist.length) % playlist.length }));
        setElapsed(0);
      }, 500);
      window.setTimeout(() => {
        busy.current = false;
        setWipe(0);
      }, 1150);
    },
    [playlist.length, modeKey]
  );

  const next = useCallback(() => go(1), [go]);
  const prev = useCallback(() => go(-1), [go]);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => {
      setElapsed((e) => {
        if (e + 0.2 >= panel.seconds) {
          next();
          return panel.seconds;
        }
        return e + 0.2;
      });
    }, 200);
    return () => clearInterval(t);
  }, [paused, panel.seconds, next]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || panel.id !== 'video') return;
    if (paused) v.pause();
    else v.play().catch(() => {});
  }, [paused, panel.id, index]);

  const wake = useCallback(() => {
    setShowControls(true);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setShowControls(false), 3500);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        e.preventDefault();
        setPaused((p) => !p);
      } else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key.toLowerCase() === 'l') setForced((f) => (f === 'live' ? 'attract' : 'live'));
      else if (e.key.toLowerCase() === 'a') setForced(null);
      else if (e.key.toLowerCase() === 'f') document.documentElement.requestFullscreen?.().catch(() => {});
      wake();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousemove', wake);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousemove', wake);
    };
  }, [next, prev, wake]);

  const progress = Math.min(1, elapsed / panel.seconds);

  return (
    <div className={`kiosk ${showControls ? 'kiosk--controls' : ''}`}>
      <div className="kiosk__stage">
        <header className="kiosk__header">
          <div className="kiosk__brand">
            <img src="/brand/aida-logo.png" alt="AIDA" />
            <div className="kiosk__brand-text">
              <span>AI &amp; Data Analytics Club</span>
              <span>Ajman University</span>
            </div>
          </div>
          <div className="kiosk__header-right">
            <span className="kiosk__now" key={panel.id}>
              {PANEL_LABEL[panel.id]}
            </span>
            <span className={`kiosk__pill ${live ? 'kiosk__pill--live' : ''}`}>
              <span className="kiosk__dot" />
              {live ? `Live · ${data.totalPlayers} played` : 'Club Fair 2026'}
            </span>
          </div>
        </header>

        <div className="kiosk__progress" aria-hidden="true">
          <div className={`kiosk__progress-fill ${paused ? 'kiosk__progress-fill--paused' : ''}`} style={{ width: `${progress * 100}%` }} />
        </div>

        <div className="kiosk__panels">
          <section key={`${modeKey}-${index}`} className="kiosk__panel kiosk__panel--active">
            {panel.id === 'video' && <VideoPanel videoRef={videoRef} qrWhatsapp={qrWhatsapp} />}
            {panel.id === 'game' && <GamePanel qr={qr} siteUrl={siteUrl} data={data} />}
            {panel.id === 'prizes' && <PrizesPanel qr={qr} qrWhatsapp={qrWhatsapp} siteUrl={siteUrl} />}
            {panel.id === 'board' && <BoardPanel data={data} qr={qr} />}
          </section>

          {wipe > 0 && <div key={wipe} className="kiosk__wipe kiosk__wipe--run" aria-hidden="true" />}

          {splash && (
            <div className="k-splash" role="status">
              <span className="k-splash__eyebrow">New top score</span>
              <img src={avatarFor(splash.masked_id_suffix + splash.display_name)} alt="" />
              <span className="k-splash__name">{playerLabel(splash, data.mode)}</span>
              <span className="k-splash__score">{splash.total_score} / 1000</span>
            </div>
          )}

          <div className="kiosk__dots" aria-hidden="true">
            {playlist.map((p, i) => (
              <span key={i} className={i === index % playlist.length ? 'is-active' : ''} />
            ))}
          </div>

          <div className="kiosk__controls" role="toolbar" aria-label="Kiosk controls">
            <button onClick={prev} aria-label="Previous panel">‹</button>
            <button onClick={() => setPaused((p) => !p)} className={paused ? 'is-on' : ''}>
              {paused ? 'Resume' : 'Pause'}
            </button>
            <button onClick={next} aria-label="Next panel">›</button>
            <button onClick={() => setForced(null)} className={forced === null ? 'is-on' : ''}>
              Auto
            </button>
            <button onClick={() => setForced('attract')} className={forced === 'attract' ? 'is-on' : ''}>
              Attract
            </button>
            <button onClick={() => setForced('live')} className={forced === 'live' ? 'is-on' : ''}>
              Live
            </button>
            <button onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})}>Full</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Reveal({ text, em, offset = 0 }: { text: string; em?: boolean; offset?: number }) {
  const words = text.split(' ');
  return (
    <>
      {words.map((w, i) => (
        <span key={i} className="k-reveal" style={{ ['--i' as string]: offset + i }}>
          <span>{em ? <em>{w}</em> : w}</span>
          {i < words.length - 1 ? '\u00a0' : ''}
        </span>
      ))}
    </>
  );
}

function Counter({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  const [bump, setBump] = useState(0);
  const prevRef = useRef(value);
  useEffect(() => {
    const from = prevRef.current;
    if (from === value) return;
    prevRef.current = value;
    setBump((b) => b + 1);
    const start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / 900);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(from + (value - from) * eased));
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return (
    <span key={bump} className={`k-num ${bump ? 'k-num--bump' : ''}`}>
      {shown}
    </span>
  );
}

function Rows({ rows, mode }: { rows: KioskRow[]; mode: KioskData['mode'] }) {
  const [moved, setMoved] = useState<Set<string>>(new Set());
  const prevRanks = useRef<Map<string, number> | null>(null);
  useEffect(() => {
    const next = new Map(rows.map((r) => [r.masked_id_suffix + r.display_name, r.rank]));
    const prev = prevRanks.current;
    prevRanks.current = next;
    if (!prev) return;
    const changed = new Set<string>();
    for (const [k, rank] of next) {
      const p = prev.get(k);
      if (p !== undefined && p !== rank) changed.add(k);
    }
    if (changed.size === 0) return;
    const t = setTimeout(() => setMoved(changed), 0);
    const clear = setTimeout(() => setMoved(new Set()), 1500);
    return () => {
      clearTimeout(t);
      clearTimeout(clear);
    };
  }, [rows]);
  return (
    <ol className="k-rows">
      {rows.map((row, i) => {
        const k = row.masked_id_suffix + row.display_name;
        return (
          <li
            key={k}
            className={`k-row ${row.rank <= 3 ? `k-row--${row.rank}` : ''} ${moved.has(k) ? 'k-row--moved' : ''}`}
            style={{ ['--i' as string]: i }}
          >
            <span className="k-row__rank">{row.rank}</span>
            <img className="k-row__avatar" src={avatarFor(k)} alt="" />
            <span className="k-row__name">{playerLabel(row, mode)}</span>
            <span className="k-row__score">
              <Counter value={row.total_score} />
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function VideoPanel({ videoRef, qrWhatsapp }: { videoRef: React.RefObject<HTMLVideoElement | null>; qrWhatsapp: string }) {
  return (
    <div className="k-panel k-video">
      <div className="k-video__frame">
        <video ref={videoRef} src="/kiosk/regwiz.mp4" muted playsInline preload="auto" loop={false} />
      </div>
      <div className="k-strip">
        <div className="k-strip__copy">
          <span className="k-strip__title">
            <Reveal text="RegWiz — course registration, without the headache." />
          </span>
          <span className="k-strip__sub k-fade" style={{ ['--i' as string]: 3 }}>
            Built by AIDA students for AU students. Ask us for a demo at the booth.
          </span>
        </div>
        <div className="k-strip__qr k-fade" style={{ ['--i' as string]: 4 }}>
          <span>
            Want early access?
            <br />
            Join our WhatsApp
          </span>
          <img src={qrWhatsapp} alt="QR code for the AIDA WhatsApp group" />
        </div>
      </div>
    </div>
  );
}

function GamePanel({ qr, siteUrl, data }: { qr: string; siteUrl: string; data: KioskData }) {
  return (
    <div className="k-scene">
      <div className="k-scene__bg" style={{ backgroundImage: "url('/backgrounds/homepage-clean.png')" }} />
      <div className="k-scene__veil" />
      <AnimatedSprite name="emirati-boy" speed="1.4s" className="k-sprite" style={{ left: '3%', height: '30%' }} />
      <AnimatedSprite name="girl-purple-hijab-up" speed="1.5s" className="k-sprite" style={{ left: '12%', height: '28%' }} />
      <AnimatedSprite name="robot-arms-raised" speed="1.3s" className="k-sprite" style={{ right: '3%', height: '30%' }} />
      <AnimatedSprite name="robot-cheering" speed="1.6s" className="k-sprite" style={{ right: '13%', height: '26%' }} />
      <div className="k-center">
        <span className="k-eyebrow k-fade" style={{ ['--i' as string]: 0 }}>
          The 60 second challenge
        </span>
        <div className="k-fade" style={{ ['--i' as string]: 1 }}>
          <Wordmark name="humans-vs-ai" as="div" className="w-[640px]" />
        </div>
        <div className="k-fade" style={{ ['--i' as string]: 2 }}>
          <ClashBeam humanWins={data.humanWins || 1} aiWins={data.aiWins || 1} className="w-[680px]" />
        </div>
        <div className="k-rounds">
          <div className="k-round">
            <div className="k-round__head">
              <span className="k-round__num">01</span>
              <span className="k-round__name">Spot the fake</span>
            </div>
            <p className="k-round__desc">Eight photos. Real, or AI-generated? You get seconds each.</p>
            <span className="k-round__time">8 × 8 seconds</span>
          </div>
          <div className="k-round">
            <div className="k-round__head">
              <span className="k-round__num">02</span>
              <span className="k-round__name">Draw vs AI</span>
            </div>
            <p className="k-round__desc">Sketch the word. Our on-device model guesses what you drew.</p>
            <span className="k-round__time">20 seconds</span>
          </div>
          <div className="k-round">
            <div className="k-round__head">
              <span className="k-round__num">03</span>
              <span className="k-round__name">AI knowledge</span>
            </div>
            <p className="k-round__desc">One question, one slider. The closer you get, the more you score.</p>
            <span className="k-round__time">8 seconds</span>
          </div>
        </div>
        <div className="k-qr-card k-fade" style={{ ['--i' as string]: 6 }}>
          <img src={qr} alt={`QR code for ${siteUrl}`} />
          <div>
            <strong>Scan. Play. Beat the AI.</strong>
            <span>One official attempt per AU student · {siteUrl.replace(/^https?:\/\//, '')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function PrizesPanel({ qr, qrWhatsapp, siteUrl }: { qr: string; qrWhatsapp: string; siteUrl: string }) {
  return (
    <div className="k-scene k-prizes">
      <div className="k-glow" style={{ left: '-14%', top: '-30%' }} />
      <div className="k-glow k-glow--gold" style={{ right: '-16%', bottom: '-36%' }} />
      <div className="k-prizes__head">
        <span className="k-eyebrow k-fade" style={{ ['--i' as string]: 0 }}>
          Two prizes · Club fair 2026
        </span>
        <h2 className="k-prizes__title">
          <Reveal text="Two ChatGPT Plus subscriptions" /> <Reveal text="are up for grabs." offset={4} />
        </h2>
      </div>
      <div className="k-prizes__cards">
        <article className="k-card k-fade" style={{ ['--i' as string]: 2 }}>
          <header className="k-card__head">
            <span className="k-card__tag">Top score</span>
            <span className="k-card__value">
              <small>worth</small> AED 75
            </span>
          </header>
          <div className="k-card__product">
            <span className="k-card__brand">ChatGPT</span>
            <span className="k-card__plan">Plus</span>
            <span className="k-card__term">1 month · paid by the club</span>
          </div>
          <p className="k-card__how">Play the 60 second challenge. The highest score on the leaderboard when the fair closes wins.</p>
          <footer className="k-card__foot">
            <img src={qr} alt={`QR code for ${siteUrl}`} />
            <div>
              <strong>Scan to play</strong>
              <span>{siteUrl.replace(/^https?:\/\//, '')} · one attempt per student</span>
            </div>
          </footer>
        </article>
        <article className="k-card k-card--alt k-fade" style={{ ['--i' as string]: 3 }}>
          <header className="k-card__head">
            <span className="k-card__tag">Member raffle</span>
            <span className="k-card__value">
              <small>worth</small> AED 75
            </span>
          </header>
          <div className="k-card__product">
            <span className="k-card__brand">ChatGPT</span>
            <span className="k-card__plan">Plus</span>
            <span className="k-card__term">1 month · drawn at the end of the fair</span>
          </div>
          <p className="k-card__how">Join AIDA on ORS during the fair and you are in the draw. ORS → New Request → Student Life → Club Membership → AI &amp; Data Science Club.</p>
          <footer className="k-card__foot">
            <img src={qrWhatsapp} alt="QR code for the AIDA WhatsApp group" />
            <div>
              <strong>Scan for the ORS steps</strong>
              <span>Joins our WhatsApp group · we walk you through it</span>
            </div>
          </footer>
        </article>
      </div>
    </div>
  );
}

function BoardPanel({ data, qr }: { data: KioskData; qr: string }) {
  const total = data.humanWins + data.aiWins;
  const humanPct = total > 0 ? Math.round((data.humanWins / total) * 100) : 50;
  return (
    <div className="k-scene">
      <div className="k-scene__bg" style={{ backgroundImage: "url('/backgrounds/circuit-16x9.png')", opacity: 0.5 }} />
      <div className="k-panel k-board">
        <div className="k-board__left">
          <span className="k-eyebrow k-fade" style={{ ['--i' as string]: 0 }}>
            Live leaderboard
          </span>
          <h2 className="k-board__title">
            <Reveal text="Top human challengers" />
          </h2>
          <div className="k-stats">
            <div className="k-stat k-fade" style={{ ['--i' as string]: 3 }}>
              <b>
                <Counter value={data.totalPlayers} />
              </b>
              <span>Played</span>
            </div>
            <div className="k-stat k-fade" style={{ ['--i' as string]: 4 }}>
              <b>
                <Counter value={data.topScore} />
              </b>
              <span>Top score</span>
            </div>
            <div className="k-stat k-fade" style={{ ['--i' as string]: 5 }}>
              <b>
                <Counter value={data.playingNow} />
              </b>
              <span>Playing now</span>
            </div>
          </div>
          <div className="k-tally k-fade" style={{ ['--i' as string]: 6 }}>
            <span style={{ color: '#fdc52a' }}>Humans {humanPct}%</span>
            <div className="k-tally__bar">
              <div className="k-tally__human" style={{ width: `${humanPct}%` }} />
              <div className="k-tally__ai" />
            </div>
            <span style={{ color: '#7ffafe' }}>{100 - humanPct}% AI</span>
          </div>
          <div className="k-qr-card k-fade" style={{ alignSelf: 'flex-start', ['--i' as string]: 7 }}>
            <img src={qr} alt="QR code to play" style={{ width: 120, height: 120 }} />
            <div>
              <strong>Think you can beat them?</strong>
              <span>Scan to play · one attempt per student</span>
            </div>
          </div>
        </div>
        <div className="k-board__right">
          {data.rows.length === 0 ? (
            <div className="k-empty">No scores yet. Be the first challenger.</div>
          ) : (
            <Rows rows={data.rows} mode={data.mode} />
          )}
        </div>
      </div>
    </div>
  );
}
