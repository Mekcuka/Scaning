import { describe, expect, it } from 'vitest';
import { wellsLocalEqual } from './wellTrajectoryLayoutRegenerate';

describe('wellTrajectoryLayoutRegenerate', () => {
  it('wellsLocalEqual compares east/north pairs', () => {
    const a = [{ east_m: 0, north_m: 0 }, { east_m: 9, north_m: 0 }];
    const b = [{ east_m: 0, north_m: 0 }, { east_m: 9, north_m: 0 }];
    const c = [{ east_m: 0, north_m: 0 }, { east_m: 10, north_m: 0 }];
    expect(wellsLocalEqual(a, b)).toBe(true);
    expect(wellsLocalEqual(a, c)).toBe(false);
    expect(wellsLocalEqual(a, [a[0]])).toBe(false);
  });
});
