import { describe, expect, it } from 'vitest';
import {
  computeHillshade,
  elevationRgb,
  formatElevationM,
  gradientRgbAt,
  normalizeElevation,
} from './padEarthworkDemPreview';

describe('padEarthworkDemPreview', () => {
  it('elevationRgb maps low to blue and high to light tones', () => {
    const low = elevationRgb(100, 100, 200);
    const high = elevationRgb(200, 100, 200);
    expect(low[2]).toBeGreaterThan(low[0]);
    expect(high[0] + high[1] + high[2]).toBeGreaterThan(low[0] + low[1] + low[2]);
  });

  it('gradientRgbAt spans blue to light palette', () => {
    const bottom = gradientRgbAt(0);
    const top = gradientRgbAt(1);
    expect(bottom[2]).toBeGreaterThan(bottom[0]);
    expect(top[0] + top[1] + top[2]).toBeGreaterThan(600);
  });

  it('normalizeElevation clamps to 0..1', () => {
    expect(normalizeElevation(150, 100, 200)).toBe(0.5);
    expect(normalizeElevation(50, 100, 200)).toBe(0);
    expect(normalizeElevation(250, 100, 200)).toBe(1);
  });

  it('computeHillshade returns normalized values', () => {
    const elevations = [100, 101, 102, 103, 104, 105, 106, 107, 108];
    const shade = computeHillshade(elevations, 3, 3);
    expect(shade.length).toBe(9);
    for (const value of shade) {
      expect(value).toBeGreaterThanOrEqual(0.25);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it('formatElevationM renders meters', () => {
    expect(formatElevationM(203.4)).toBe('203.4 м');
  });
});
