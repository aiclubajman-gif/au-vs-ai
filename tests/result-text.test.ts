import { describe, it, expect } from 'vitest';
import { formatRank, formatPercentile, formatBeaten, formatTopShare } from '@/lib/client/result-text';

describe('Result screen copy', () => {
  it('shows the top share as the Human Win screen computes it', () => {
    expect(formatTopShare(93, 175)).toBe('7%');
    expect(formatTopShare(100, 175)).toBe('1%');
    expect(formatTopShare(0, 175)).toBe('100%');
    expect(formatTopShare(0, 1)).toBe('—');
  });

  it('shows the share beaten as the server returns it', () => {
    expect(formatBeaten(60, 175)).toBe('60%');
    expect(formatBeaten(0, 175)).toBe('0%');
    expect(formatBeaten(100, 175)).toBe('100%');
  });

  it('shows a dash when there is nobody else to have beaten', () => {
    expect(formatBeaten(0, 1)).toBe('—');
    expect(formatBeaten(0, 0)).toBe('—');
  });

  it('shows the rank as the server returns it', () => {
    expect(formatRank(7)).toBe('#7');
    expect(formatRank(124)).toBe('#124');
  });

  it('turns the share beaten into "top X%" in the top half', () => {
    expect(formatPercentile(96, 175)).toEqual({ text: 'Top 4%', caption: 'of challengers' });
    expect(formatPercentile(50, 175)).toEqual({ text: 'Top 50%', caption: 'of challengers' });
  });

  it('never claims "top 0%" for the best score', () => {
    expect(formatPercentile(100, 175).text).toBe('Top 1%');
  });

  it('uses a plain count below the top half', () => {
    expect(formatPercentile(49, 175)).toEqual({ text: 'Of 175', caption: 'challengers' });
    expect(formatPercentile(0, 175)).toEqual({ text: 'Of 175', caption: 'challengers' });
  });

  it('has nothing to compare the first challenger with', () => {
    expect(formatPercentile(0, 1)).toEqual({ text: 'First', caption: 'challenger' });
    expect(formatPercentile(0, 0)).toEqual({ text: 'First', caption: 'challenger' });
  });
});
