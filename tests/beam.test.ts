import { describe, it, expect } from 'vitest';
import { calculateImpactPosition } from '@/components/game/ClashBeam';

describe('Dynamic ClashBeam - Acceptance Tests (§17)', () => {
  it('Impact is centered at 50/50', () => {
    expect(calculateImpactPosition(50, 50)).toBe(160);
    expect(calculateImpactPosition(100, 100)).toBe(160);
    expect(calculateImpactPosition(0, 0)).toBe(160);
  });

  it('Human advantage moves impact right (showing more orange)', () => {
    const neutral = calculateImpactPosition(50, 50);
    const humanWinning = calculateImpactPosition(75, 25);
    const humanDominating = calculateImpactPosition(90, 10);

    expect(humanWinning).toBeGreaterThan(neutral);
    expect(humanDominating).toBeGreaterThan(humanWinning);
    expect(humanWinning).toBe(210); // 60 + 0.75 * 200 = 210
  });

  it('AI advantage moves impact left (showing more blue)', () => {
    const neutral = calculateImpactPosition(50, 50);
    const aiWinning = calculateImpactPosition(25, 75);
    const aiDominating = calculateImpactPosition(10, 90);

    expect(aiWinning).toBeLessThan(neutral);
    expect(aiDominating).toBeLessThan(aiWinning);
    expect(aiWinning).toBe(110); // 60 + 0.25 * 200 = 110
  });

  it('0/100 does not break layout (clamped within visible bounds)', () => {
    const aiMax = calculateImpactPosition(0, 100);
    expect(aiMax).toBe(60);
    expect(aiMax).toBeGreaterThanOrEqual(10); // left bound
  });

  it('100/0 does not break layout (clamped within visible bounds)', () => {
    const humanMax = calculateImpactPosition(100, 0);
    expect(humanMax).toBe(260);
    expect(humanMax).toBeLessThanOrEqual(310); // right bound
  });

  it('Production scores (e.g. 6 wins vs 3 wins / 67% vs 33%) show clearly shifted beam', () => {
    const result = calculateImpactPosition(6, 3);
    expect(result).toBeGreaterThan(190); // Clearly past 160 center!
    expect(result).toBeLessThanOrEqual(260);
  });
});
