'use client';

import { useEffect, useRef } from 'react';

type Props = { humanWins: number; aiWins: number };
const W = 320, H = 96, HUMAN_W = 200, HUMAN_H = 64, IMPACT_W = 72, IMPACT_H = 72;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const ease = (t: number) => t * t * (3 - 2 * t);

export default function DynamicClashBeam({ humanWins, aiWins }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scoreRef = useRef({ humanWins, aiWins });
  scoreRef.current = { humanWins, aiWins };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    const human = new Image(), ai = new Image(), impact = new Image();
    human.src = '/sprites/beam-human-spritesheet.png';
    ai.src = '/sprites/beam-ai-spritesheet.png';
    impact.src = '/sprites/beam-impact-spritesheet.png';
    let raf = 0, visible = true, running = true, currentX = 160, fromX = 160, targetX = 160, started = performance.now();
    const setTarget = () => {
      const { humanWins: h, aiWins: a } = scoreRef.current;
      const total = h + a;
      const ratio = total > 0 ? h / total : .5;
      fromX = currentX;
      targetX = clamp(160 + ((ratio - (1 - ratio)) * 40), 120, 200);
      started = performance.now();
    };
    let lastH = humanWins, lastA = aiWins;
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; });
    observer.observe(canvas);
    const drawSparks = (time: number, x: number, humanRatio: number) => {
      const count = 8;
      for (let i = 0; i < count; i++) {
        const phase = time / 90 + i * 19;
        const orange = i < Math.round(count * humanRatio);
        const dir = orange ? -1 : 1;
        const px = Math.round(x + dir * (8 + ((phase * 7) % 34)));
        const py = Math.round(48 + Math.sin(phase) * (8 + ((i * 11) % 20)));
        ctx.fillStyle = orange ? '#ff8c00' : '#00c4ff';
        ctx.fillRect(px, py, 2 + (i % 2), 2 + (i % 3));
      }
    };
    const frame = (time: number) => {
      if (!running) return;
      const { humanWins: h, aiWins: a } = scoreRef.current;
      if (h !== lastH || a !== lastA) { lastH = h; lastA = a; setTarget(); }
      if (visible && !document.hidden) {
        currentX = fromX + (targetX - fromX) * ease(clamp((time - started) / 600, 0, 1));
        const impactX = Math.round(currentX);
        const total = h + a;
        const humanRatio = total > 0 ? h / total : .5;
        ctx.clearRect(0, 0, W, H);
        ctx.save(); ctx.beginPath(); ctx.rect(10, 0, impactX - 10, H); ctx.clip();
        ctx.drawImage(human, (Math.floor(time / 100) % 4) * HUMAN_W, 0, HUMAN_W, HUMAN_H, impactX - 190, 16, HUMAN_W, HUMAN_H); ctx.restore();
        ctx.save(); ctx.beginPath(); ctx.rect(impactX, 0, 310 - impactX, H); ctx.clip();
        ctx.drawImage(ai, (Math.floor(time / 100) % 4) * HUMAN_W, 0, HUMAN_W, HUMAN_H, impactX - 10, 16, HUMAN_W, HUMAN_H); ctx.restore();
        drawSparks(time, impactX, humanRatio);
        ctx.drawImage(impact, (Math.floor(time / 100) % 6) * IMPACT_W, 0, IMPACT_W, IMPACT_H, impactX - 36, 12, IMPACT_W, IMPACT_H);
      }
      raf = requestAnimationFrame(frame);
    };
    Promise.all([human.decode().catch(() => {}), ai.decode().catch(() => {}), impact.decode().catch(() => {})]).finally(() => { raf = requestAnimationFrame(frame); });
    return () => { running = false; cancelAnimationFrame(raf); observer.disconnect(); };
  }, []);

  return <canvas ref={canvasRef} width={W} height={H} className="pixelBeam" aria-label="Live Humans versus AI energy clash" role="img" />;
}
