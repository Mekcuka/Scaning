import { describe, expect, it } from 'vitest';
import { clampLineLodScaleThreshold, lineLodForScale } from './mapLineLod';

describe('mapLineLod', () => {
  it('lineLodForScale uses endpoints when scale is coarser than threshold', () => {
    expect(lineLodForScale(400_000, 300_000)).toBe('endpoints');
    expect(lineLodForScale(200_000, 300_000)).toBe('full');
  });

  it('clampLineLodScaleThreshold bounds values', () => {
    expect(clampLineLodScaleThreshold(10)).toBe(50_000);
    expect(clampLineLodScaleThreshold(500_000)).toBe(500_000);
    expect(clampLineLodScaleThreshold(9_000_000)).toBe(1_500_000);
  });
});
