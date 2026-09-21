'use client';

import { useEffect, useRef, useState } from 'react';

const WIDTH = 320;
const HEIGHT = 96;
const CENTER_Y = 48;

const HUMAN_FRAME = { width: 200, height: 64, contactX: 190, contactY: 32 };
const AI_FRAME = { width: 200, height: 64, contactX: 10, contactY: 32 };
const IMPACT_FRAME = { width: 72, height: 72, centerX: 36, centerY: 36 };
// Base anchors on the 320px canvas (matching original pixel art: Human base at x=25, AI base at x=295)
const HUMAN_ORIGIN_X = 24;
const AI_ORIGIN_X = 296;
const IGNITE_AT_MS = 1350;
const IGNITE_MS = 300;
const GROW_MS = 220;

const HUMAN_SPARK_COLORS = ['#B83A00', '#F05A00', '#FF8C00', '#FFC928', '#FFF0A0'];
const AI_SPARK_COLORS = ['#004A9F', '#0079E8', '#00C4FF', '#62ECFF', '#DFFFFF'];
const WHITE_COLOR = '#FFFFFF';
const MAX_SPARKS = 32;
interface Spark {
  active: boolean;
  isHuman: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  color: string;
  lifetime: number;
  maxLife: number;
}

const sparkPool: Spark[] = Array.from({ length: MAX_SPARKS }, () => ({
  active: false,
  isHuman: true,
  x: 160,
  y: CENTER_Y,
  vx: 0,
  vy: 0,
  w: 2,
  h: 2,
  color: WHITE_COLOR,
  lifetime: 0,
  maxLife: 250,
}));

export interface ClashBeamProps {
  humanWins: number;
  aiWins: number;
  className?: string;
  showLabels?: boolean;
  fighters?: boolean;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function calculateImpactPosition(humanWins: number, aiWins: number): number {
  const total = humanWins + aiWins;
  if (total <= 0) return 160;
  const humanRatio = humanWins / total;

  // Visible dynamic range: 60px (heavy AI win) to 260px (heavy Human win) on 320px canvas
  // 50/50 -> 160 (exact center)
  // 75/25 Human -> 210 (visibly shows mostly orange beam!)
  // 25/75 Human (75% AI) -> 110 (visibly shows mostly blue beam!)
  const MIN_IMPACT = 60;
  const MAX_IMPACT = 260;
  return clamp(MIN_IMPACT + humanRatio * (MAX_IMPACT - MIN_IMPACT), MIN_IMPACT, MAX_IMPACT);
}

export function ClashBeam({ humanWins: propHumanWins, aiWins: propAiWins, className = '', showLabels = true, fighters = true }: ClashBeamProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isVisibleRef = useRef(true);
  const surgeRef = useRef(0);
  const [surge, setSurge] = useState(0);
  const litRef = useRef(false);
  const [lit, setLit] = useState(false);

  // Allow live polling and URL override (?h=80&a=20) for easy visual testing
  const scoreRef = useRef({ humanWins: propHumanWins, aiWins: propAiWins });
  const pinnedRef = useRef(false);

  useEffect(() => {
    if (!pinnedRef.current) scoreRef.current = { humanWins: propHumanWins, aiWins: propAiWins };
  }, [propHumanWins, propAiWins]);

  useEffect(() => {
    // Check for testing query params (e.g. ?h=90&a=10 or ?human=80&ai=20)
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const hParam = params.get('h') ?? params.get('human');
      const aParam = params.get('a') ?? params.get('ai');
      if (hParam !== null && aParam !== null) {
        const h = parseInt(hParam, 10);
        const a = parseInt(aParam, 10);
        if (!isNaN(h) && !isNaN(a)) {
          scoreRef.current = { humanWins: h, aiWins: a };
          pinnedRef.current = true;
        }
      }
    }

    const poll = async () => {
      try {
        const res = await fetch('/api/kiosk', { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        if (json.ok && json.data) {
          const params = new URLSearchParams(window.location.search);
          if (!params.has('h') && !params.has('human')) {
            const h = json.data.humanWins;
            const a = json.data.aiWins;
            if (typeof h === 'number' && typeof a === 'number' && h + a > 0) {
              scoreRef.current = { humanWins: h, aiWins: a };
              pinnedRef.current = true;
            }
          }
        }
      } catch {}
    };
    poll();
    const interval = setInterval(poll, 8000);

    return () => clearInterval(interval);
  }, [propHumanWins, propAiWins]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;
    const humanImg = new Image();
    const aiImg = new Image();
    const impactImg = new Image();

    humanImg.src = '/sprites/beam-human-spritesheet.png';
    aiImg.src = '/sprites/beam-ai-spritesheet.png';
    impactImg.src = '/sprites/beam-impact-spritesheet.png';

    const checkImages = () => {
      if (humanImg.complete && aiImg.complete && impactImg.complete) {
      }
    };

    humanImg.onload = checkImages;
    aiImg.onload = checkImages;
    impactImg.onload = checkImages;
    humanImg.onerror = () => {};
    aiImg.onerror = () => {};
    impactImg.onerror = () => {};

    let frameId = 0;
    let prevTime = 0;
    let currentImpactX = calculateImpactPosition(scoreRef.current.humanWins, scoreRef.current.aiWins);
    let sparkSpawnTimer = 0;
    let surgeOffset = 0;
    let surgePhase: 'idle' | 'push' | 'hold' | 'release' = 'idle';
    let surgeSide = 1;
    let surgeAmount = 0;
    let surgeTimer = 0;
    let surgeWait = 9000 + Math.random() * 9000;

    const reduceMotion = typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0];
      isVisibleRef.current = entry ? entry.isIntersecting : true;
    }, { threshold: 0.05 });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    const handleVisibilityChange = () => {
      isVisibleRef.current = !document.hidden;
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    let startTime = 0;
    const render = (time: number) => {
      if (!reduceMotion) {
        frameId = requestAnimationFrame(render);
      }
      if (!isVisibleRef.current) return;
      if (!startTime) startTime = time;

      const dt = Math.min(time - prevTime || 16, 50);
      prevTime = time;
      const sinceStart = time - startTime;
      const ignite = reduceMotion ? 1 : Math.max(0, Math.min(1, (sinceStart - IGNITE_AT_MS) / IGNITE_MS));
      if (ignite <= 0) {
        ctx.clearRect(0, 0, WIDTH, HEIGHT);
        return;
      }
      const grow = reduceMotion ? 1 : Math.max(0, Math.min(1, (sinceStart - IGNITE_AT_MS - IGNITE_MS) / GROW_MS));
      const reach = Math.ceil(grow * 8) / 8;
      if (reach >= 1 && !litRef.current) {
        litRef.current = true;
        setLit(true);
      }
      if (ignite < 1) {
        ctx.clearRect(0, 0, WIDTH, HEIGHT);
        if (impactImg.complete && impactImg.naturalWidth > 0) {
          const f = Math.min(5, Math.floor(ignite * 6));
          const sz = 44;
          for (const ox of [HUMAN_ORIGIN_X, AI_ORIGIN_X]) {
            ctx.drawImage(
              impactImg,
              f * IMPACT_FRAME.width,
              0,
              IMPACT_FRAME.width,
              IMPACT_FRAME.height,
              ox - sz / 2,
              CENTER_Y - sz / 2,
              sz,
              sz
            );
          }
        }
        return;
      }
      const scores = scoreRef.current;
      const baseImpactX = calculateImpactPosition(scores.humanWins, scores.aiWins);

      if (!reduceMotion) {
        surgeTimer += dt;
        if (surgePhase === 'idle' && surgeTimer >= surgeWait) {
          surgePhase = 'push';
          surgeTimer = 0;
          surgeSide = Math.random() < 0.5 ? 1 : -1;
          surgeAmount = 18 + Math.random() * 30;
        } else if (surgePhase === 'push') {
          const t = Math.min(1, surgeTimer / 320);
          surgeOffset = surgeSide * surgeAmount * (1 - Math.pow(1 - t, 3));
          if (t >= 1) {
            surgePhase = 'hold';
            surgeTimer = 0;
          }
        } else if (surgePhase === 'hold') {
          surgeOffset = surgeSide * surgeAmount + Math.sin(surgeTimer / 40) * 1.5;
          if (surgeTimer >= 350) {
            surgePhase = 'release';
            surgeTimer = 0;
          }
        } else if (surgePhase === 'release') {
          const t = Math.min(1, surgeTimer / 280);
          surgeOffset = surgeSide * surgeAmount * Math.pow(1 - t, 2);
          if (t >= 1) {
            surgePhase = 'idle';
            surgeOffset = 0;
            surgeTimer = 0;
            surgeWait = 12000 + Math.random() * 13000;
          }
        }
      }

      const targetImpactX = clamp(baseImpactX + surgeOffset, 40, 280);
      currentImpactX += (targetImpactX - currentImpactX) * (1 - Math.exp(-dt / 60));
      const surgeNow = surgePhase === 'idle' ? 0 : surgeSide;
      if (surgeNow !== surgeRef.current) {
        surgeRef.current = surgeNow;
        setSurge(surgeNow);
      }

      const total = scores.humanWins + scores.aiWins;
      const humanRatio = total > 0 ? scores.humanWins / total : 0.5;
      const aiRatio = total > 0 ? scores.aiWins / total : 0.5;

      const elapsed = reduceMotion ? 0 : time;
      const humanFrame = Math.floor(elapsed / 100) % 4;
      const aiFrame = Math.floor(elapsed / 100) % 4;
      const impactFrame = Math.floor(elapsed / 100) % 6;

      ctx.clearRect(0, 0, WIDTH, HEIGHT);
      ctx.imageSmoothingEnabled = false;

      const roundedImpactX = Math.round(currentImpactX);
      if (process.env.NODE_ENV !== 'production') canvas.dataset.impact = String(roundedImpactX);

      const humanStart = HUMAN_ORIGIN_X;
      const humanLen = Math.max(24, (roundedImpactX + 12 - humanStart) * reach);
      if (humanImg.complete && humanImg.naturalWidth > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, Math.max(0, roundedImpactX), HEIGHT);
        ctx.clip();
        ctx.drawImage(
          humanImg,
          humanFrame * HUMAN_FRAME.width + 14,
          0,
          HUMAN_FRAME.width - 14,
          HUMAN_FRAME.height,
          humanStart - 14,
          CENTER_Y - HUMAN_FRAME.contactY,
          humanLen,
          HUMAN_FRAME.height,
        );
        ctx.restore();
      }

      const aiEnd = AI_ORIGIN_X;
      const aiLen = Math.max(24, (aiEnd - (roundedImpactX - 12)) * reach);
      if (aiImg.complete && aiImg.naturalWidth > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(roundedImpactX, 0, Math.max(0, WIDTH - roundedImpactX), HEIGHT);
        ctx.clip();
        ctx.drawImage(
          aiImg,
          aiFrame * AI_FRAME.width,
          0,
          AI_FRAME.width - 14,
          AI_FRAME.height,
          aiEnd + 14 - aiLen,
          CENTER_Y - AI_FRAME.contactY,
          aiLen,
          AI_FRAME.height,
        );
        ctx.restore();
      }

      if (!reduceMotion && reach >= 1) {
        sparkSpawnTimer += dt;
        if (sparkSpawnTimer >= 40) {
          sparkSpawnTimer = 0;
          const humanSparkRate = 4 + 16 * humanRatio;
          const aiSparkRate = 4 + 16 * aiRatio;
          for (let s = 0; s < 2; s++) {
            const isHuman = Math.random() * (humanSparkRate + aiSparkRate) < humanSparkRate;
            for (let i = 0; i < MAX_SPARKS; i++) {
              const sp = sparkPool[i];
              if (!sp.active) {
                sp.active = true;
                sp.isHuman = isHuman;
                sp.x = roundedImpactX + (Math.random() * 8 - 4);
                sp.y = CENTER_Y + (Math.random() * 12 - 6);
                sp.lifetime = 0;
                sp.maxLife = 150 + Math.random() * 200;

                const speed = 0.8 + Math.random() * 1.5;
                if (isHuman) {
                  sp.vx = -speed * (0.6 + Math.random() * 0.8);
                  sp.vy = (Math.random() - 0.5) * speed * 1.2;
                  const cIdx = Math.floor(Math.random() * HUMAN_SPARK_COLORS.length);
                  sp.color = Math.random() < 0.15 ? WHITE_COLOR : HUMAN_SPARK_COLORS[cIdx];
                } else {
                  sp.vx = speed * (0.6 + Math.random() * 0.8);
                  sp.vy = (Math.random() - 0.5) * speed * 1.2;
                  const cIdx = Math.floor(Math.random() * AI_SPARK_COLORS.length);
                  sp.color = Math.random() < 0.15 ? WHITE_COLOR : AI_SPARK_COLORS[cIdx];
                }

                const sz = Math.random() < 0.3 ? 3 : (Math.random() < 0.7 ? 2 : 1);
                sp.w = sz;
                sp.h = sz;
                break;
              }
            }
          }
        }
        for (let i = 0; i < MAX_SPARKS; i++) {
          const sp = sparkPool[i];
          if (!sp.active) continue;
          sp.lifetime += dt;
          if (sp.lifetime >= sp.maxLife) {
            sp.active = false;
            continue;
          }
          sp.x += sp.vx;
          sp.y += sp.vy;
          ctx.fillStyle = sp.color;
          ctx.fillRect(Math.round(sp.x), Math.round(sp.y), sp.w, sp.h);
        }
      }

      // 4. IMPACT SPRITE (always on top)
      if (reach >= 1 && impactImg.complete && impactImg.naturalWidth > 0) {
        ctx.drawImage(
          impactImg,
          impactFrame * IMPACT_FRAME.width,
          0,
          IMPACT_FRAME.width,
          IMPACT_FRAME.height,
          roundedImpactX - IMPACT_FRAME.centerX,
          CENTER_Y - IMPACT_FRAME.centerY,
          IMPACT_FRAME.width,
          IMPACT_FRAME.height
        );
      }
    };
    frameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(frameId);
      observer.disconnect();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return (
    <div ref={containerRef} className={`relative mx-auto select-none ${className}`} style={{ containerType: 'inline-size' }}>
      <div className="relative aspect-[10/3] w-full overflow-visible">
        <canvas
          ref={canvasRef}
          width={WIDTH}
          height={HEIGHT}
          className="pixelated block h-full w-full"
        />
        {showLabels && (
          <div className={`px-beam-labels pointer-events-none absolute inset-0 flex items-center justify-between font-px text-[3.2cqw] text-white px-text-outline ${lit ? 'px-beam-labels--on' : ''}`}>
            <span className="ml-[22%]">HUMANS</span>
            <span className="mr-[18%]">AI</span>
          </div>
        )}
        {fighters && (
          <>
            <Fighter who="bird" surge={surge} />
            <Fighter who="cell" surge={surge} />
          </>
        )}
      </div>
    </div>
  );
}

function Fighter({ who, surge }: { who: 'bird' | 'cell'; surge: number }) {
  const [arrived, setArrived] = useState(false);
  const [beat, setBeat] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setArrived(true), who === 'bird' ? 500 : 900);
    return () => clearTimeout(t);
  }, [who]);
  useEffect(() => {
    if (!arrived) return;
    let alive = true;
    let handle = 0;
    const tick = () => {
      if (!alive) return;
      setBeat((b) => b + 1);
      handle = window.setTimeout(tick, 1400 + Math.random() * 1600);
    };
    handle = window.setTimeout(tick, who === 'bird' ? 900 : 1600);
    return () => {
      alive = false;
      clearTimeout(handle);
    };
  }, [arrived, who]);
  const mine = who === 'bird' ? 1 : -1;
  const idle = beat % 3 === 2 ? 'strain' : 'push';
  const pose = !arrived ? 'charge' : surge === mine ? 'strain' : surge === -mine ? 'charge' : idle;
  return (
    <div className={`px-fighter px-fighter--${who} ${arrived ? 'px-fighter--in' : ''} px-fighter--${pose}`} aria-hidden="true">
      <span className="px-fighter__flash" />
      <img src={`/sprites/beam/${who}-charge.png`} alt="" draggable={false} className="pixelated px-fighter__pose px-fighter__pose--charge" />
      <img src={`/sprites/beam/${who}-push.png`} alt="" draggable={false} className="pixelated px-fighter__pose px-fighter__pose--push" />
      <img src={`/sprites/beam/${who}-strain.png`} alt="" draggable={false} className="pixelated px-fighter__pose px-fighter__pose--strain" />
    </div>
  );
}
