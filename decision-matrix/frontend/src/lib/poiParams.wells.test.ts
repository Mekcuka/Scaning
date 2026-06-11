import { describe, expect, it } from 'vitest';
import { calcPadsPreview, calcWellsTotal } from './poiParams';

describe('calcWellsTotal', () => {
  it('rounds up fractional wells and enforces minimum of 1', () => {
    expect(calcWellsTotal(50, 10)).toBe(5);
    expect(calcWellsTotal(55, 10)).toBe(6);
    expect(calcWellsTotal(5, 10)).toBe(1);
    expect(calcWellsTotal(0.1, 10)).toBe(1);
  });

  it('returns 0 when production or per-well rate is not positive', () => {
    expect(calcWellsTotal(0, 10)).toBe(0);
    expect(calcWellsTotal(50, 0)).toBe(0);
  });
});

describe('calcPadsPreview', () => {
  it('uses ceiled well count for pad calculation', () => {
    expect(calcPadsPreview(55, 10, 4)).toEqual({ wells: 6, pads: 2 });
  });
});
