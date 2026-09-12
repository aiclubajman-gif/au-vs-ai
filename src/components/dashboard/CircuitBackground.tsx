import React from 'react';

/**
 * CircuitBackground — High-Energy Arena Flank Artwork & Circuit Traces
 *
 * Left: Glowing golden-amber human crowd artwork + intense circuitry.
 * Right: Glowing electric-blue AI motherboard artwork with central and satellite microchips.
 * Blended seamlessly with CSS mix-blend-mode: screen on deep navy void.
 */
export function CircuitBackground({ className = '' }: { className?: string }) {
  return (
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden select-none ${className}`}
      aria-hidden="true"
    >
      {/* Ambient background glows */}
      <div className="absolute -top-32 -left-32 h-[500px] w-[500px] rounded-full bg-[var(--color-human-orange)]/20 blur-[130px]" />
      <div className="absolute -bottom-32 -left-32 h-[500px] w-[500px] rounded-full bg-[var(--color-human-gold)]/15 blur-[130px]" />
      <div className="absolute -top-32 -right-32 h-[500px] w-[500px] rounded-full bg-[var(--color-ai-cyan)]/20 blur-[130px]" />
      <div className="absolute -bottom-32 -right-32 h-[500px] w-[500px] rounded-full bg-[var(--color-ai-blue)]/20 blur-[130px]" />

      {/* LEFT FLANK: Detailed Human Crowd & Circuit Traces */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/assets/humans_flank.jpg"
        alt=""
        className="absolute top-0 left-0 h-full w-[45%] max-w-[500px] object-cover mix-blend-screen opacity-80"
        style={{
          maskImage: 'linear-gradient(to right, rgba(0,0,0,1) 40%, rgba(0,0,0,0) 100%)',
          WebkitMaskImage: 'linear-gradient(to right, rgba(0,0,0,1) 40%, rgba(0,0,0,0) 100%)',
        }}
      />

      {/* RIGHT FLANK: Detailed AI Microchip Cluster & Circuit Traces */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/assets/ai_flank.jpg"
        alt=""
        className="absolute top-0 right-0 h-full w-[45%] max-w-[500px] object-cover mix-blend-screen opacity-80"
        style={{
          maskImage: 'linear-gradient(to left, rgba(0,0,0,1) 40%, rgba(0,0,0,0) 100%)',
          WebkitMaskImage: 'linear-gradient(to left, rgba(0,0,0,1) 40%, rgba(0,0,0,0) 100%)',
        }}
      />
    </div>
  );
}
