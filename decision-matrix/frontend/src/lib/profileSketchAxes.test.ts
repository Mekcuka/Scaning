import { describe, expect, it } from 'vitest';
import {
  axisTicks,
  formatChainageM,
  formatProfileElevationM,
  niceAxisStep,
} from './profileSketchAxes';

describe('profileSketchAxes', () => {
  it('computes nice step', () => {
    expect(niceAxisStep(100)).toBe(20);
    expect(niceAxisStep(12)).toBe(5);
  });

  it('builds axis ticks', () => {
    expect(axisTicks(0, 100, 25)).toEqual([0, 25, 50, 75, 100]);
  });

  it('formats labels', () => {
    expect(formatChainageM(12.5)).toBe('12,5');
    expect(formatProfileElevationM(150.12)).toContain('150');
  });
});
