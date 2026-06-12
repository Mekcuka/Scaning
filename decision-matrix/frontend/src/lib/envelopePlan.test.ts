import { describe, expect, it } from 'vitest';
import { envelopePlanRingSvgPath } from './envelopePlan';

describe('envelopePlan', () => {
  it('builds even-odd path with outer and inner rings', () => {
    const inner = [
      { east_m: -10, north_m: -5 },
      { east_m: 10, north_m: -5 },
      { east_m: 10, north_m: 5 },
      { east_m: -10, north_m: 5 },
    ];
    const outer = [
      { east_m: -13, north_m: -8 },
      { east_m: 13, north_m: -8 },
      { east_m: 13, north_m: 8 },
      { east_m: -13, north_m: 8 },
    ];
    const path = envelopePlanRingSvgPath(inner, outer);
    expect(path).toContain('M -13 8');
    expect(path).toContain('M -10 5');
    expect(path.split(' Z').length).toBeGreaterThanOrEqual(3);
  });
});
