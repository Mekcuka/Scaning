import { describe, expect, it } from 'vitest';
import {
  defaultProfileSketch,
  estimateProfileVolumes,
  parseProfileFromLast,
  profileLengthM,
  sortChainagePoints,
} from './padEarthworkSketch';
import { buildProfileViewBox, balanceProfileViewHalves, clampProfileSketchZoom, profileFitPan, profileViewExtents } from './profileSketchViewport';

describe('profileSketchViewport', () => {
  it('builds viewBox string', () => {
    expect(buildProfileViewBox(50, 100, 60, 10)).toBe('-10 90 120 20');
  });

  it('balances elevation half-extent to viewport aspect ratio', () => {
    const balanced = balanceProfileViewHalves(128, 5, 640, 320);
    expect(balanced.viewHalfChainage).toBe(128);
    expect(balanced.viewHalfElevation).toBeCloseTo(64, 0);
  });

  it('keeps larger elevation half-extent when already sufficient', () => {
    const balanced = balanceProfileViewHalves(50, 80, 640, 320);
    expect(balanced.viewHalfElevation).toBe(80);
  });

  it('clamps zoom', () => {
    expect(clampProfileSketchZoom(0.1)).toBe(0.25);
    expect(clampProfileSketchZoom(20)).toBe(8);
  });

  it('centers profile fit pan on data extents', () => {
    const sketch = defaultProfileSketch(120, 80, 137.3, 6);
    const extents = profileViewExtents(sketch, false, 0, 137.3);
    const pan = profileFitPan(extents);
    expect(pan.chainage_m).toBeCloseTo(60, 0);
    expect(pan.elevation_m).toBeGreaterThan(130);
  });
});

describe('profile sketch helpers', () => {
  it('parses profile from last response', () => {
    const parsed = parseProfileFromLast({
      kind: 'profile',
      width_m: 10,
      design_elevation_m: 152,
      chainage_points: [{ chainage_m: 0, elevation_m: 150 }],
    });
    expect(parsed?.width_m).toBe(10);
  });

  it('sorts chainage and estimates volumes', () => {
    const sketch = defaultProfileSketch(10, 5, 150, 2);
    const sorted = sortChainagePoints([
      { chainage_m: 10, elevation_m: 150 },
      { chainage_m: 0, elevation_m: 150 },
    ]);
    expect(sorted[0].chainage_m).toBe(0);
    expect(profileLengthM(sorted)).toBe(10);
    const vol = estimateProfileVolumes(sketch);
    expect(vol.fill_m3).toBeGreaterThan(0);
  });
});
