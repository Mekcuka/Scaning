import { describe, expect, it } from 'vitest';
import {
  computeHillshade,
  elevationRgb,
  footprintMinElevationM,
  formatElevationM,
  gradientRgbAt,
  normalizeElevation,
  type PadDemPreview,
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

  it('footprintMinElevationM prefers footprint_elev_min field', () => {
    const preview = {
      cols: 2,
      rows: 2,
      cell_size_m: 1,
      bounds: { min_east_m: 0, max_east_m: 2, min_north_m: 0, max_north_m: 2 },
      elev_min: 90,
      elev_max: 110,
      footprint_elev_min: 95.5,
      design_elevation_m: 100,
      elevations: [90, 100, 110, 95],
      cut_fill: [null, 1, null, 0],
    } satisfies PadDemPreview;
    expect(footprintMinElevationM(preview)).toBe(95.5);
  });

  it('footprintMinElevationM falls back to min inside cut_fill footprint', () => {
    const preview = {
      cols: 2,
      rows: 2,
      cell_size_m: 1,
      bounds: { min_east_m: 0, max_east_m: 2, min_north_m: 0, max_north_m: 2 },
      elev_min: 90,
      elev_max: 110,
      design_elevation_m: 100,
      elevations: [90, 100, 110, 92],
      cut_fill: [null, 1, null, -1],
    } satisfies PadDemPreview;
    expect(footprintMinElevationM(preview)).toBe(92);
  });
});
