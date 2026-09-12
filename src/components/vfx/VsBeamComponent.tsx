'use client';

import React, { useEffect, useRef } from 'react';
import { createVsBeam, type VsBeamInstance } from '@/lib/vfx/vsBeam';

interface VsBeamComponentProps {
  humanScore: number;
  aiScore: number;
  compact?: boolean;
  className?: string;
  humanColor?: string;
  aiColor?: string;
}

/**
 * VsBeamComponent — React wrapper for the self-contained WebGL2/Canvas/CSS energy beam.
 *
 * Exposes score-driven reactivity with smooth lerping, idle shimmer, and spark bursts.
 */
export function VsBeamComponent({
  humanScore,
  aiScore,
  compact = false,
  className = '',
  humanColor = '#ff8c1a',
  aiColor = '#4d6bff',
}: VsBeamComponentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const beamInstanceRef = useRef<VsBeamInstance | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const instance = createVsBeam(containerRef.current, {
      humanColor,
      aiColor,
      resolutionScale: compact ? 0.55 : 0.7,
      sparkBudget: compact ? 80 : 160,
    });
    beamInstanceRef.current = instance;

    instance.setScore(humanScore, aiScore);

    return () => {
      instance.destroy();
      beamInstanceRef.current = null;
    };
  }, [humanColor, aiColor, compact]);

  useEffect(() => {
    if (beamInstanceRef.current) {
      beamInstanceRef.current.setScore(humanScore, aiScore);
    }
  }, [humanScore, aiScore]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full overflow-visible ${
        compact ? 'h-12 sm:h-14' : 'h-16 sm:h-20 md:h-24'
      } ${className}`}
      style={{
        borderRadius: '9999px',
      }}
    />
  );
}
