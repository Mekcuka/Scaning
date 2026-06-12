import { describe, expect, it } from 'vitest';
import {
  buildProfileEnvelopePolyline,
  envelopeSurfaceElevation,
  estimateProfileEnvelopeVolumes,
  profileEnvelopeExtraVolumeM3,
  type ProfileEnvelopeParams,
} from './profileEnvelope';
import { estimateProfileVolumes, type ProfileSketch } from './padEarthworkSketch';

const baseParams: ProfileEnvelopeParams = {
  minChainage: 0,
  maxChainage: 100,
  designElevationM: 152,
  referenceElevationM: 150,
  wrapWidthM: 3,
};

describe('envelopeSurfaceElevation', () => {
  it('returns design elevation on pad chainage span', () => {
    expect(envelopeSurfaceElevation(50, baseParams)).toBe(152);
    expect(envelopeSurfaceElevation(0, baseParams)).toBe(152);
    expect(envelopeSurfaceElevation(100, baseParams)).toBe(152);
  });

  it('returns reference outside pad chainage span', () => {
    expect(envelopeSurfaceElevation(-1, baseParams)).toBe(150);
    expect(envelopeSurfaceElevation(101, baseParams)).toBe(150);
  });
});

describe('buildProfileEnvelopePolyline', () => {
  it('builds symmetric trapezoidal end-cap berm with H = (W − TW) / 2', () => {
    expect(buildProfileEnvelopePolyline(baseParams)).toBe(
      '0,152 1,153 99,153 100,152',
    );
  });
});

describe('profileEnvelopeExtraVolumeM3', () => {
  it('matches berm ring volume for L=100 W=40 w=3 (variant A trapezoid)', () => {
    expect(profileEnvelopeExtraVolumeM3(100, 40, 2, 3)).toBe(560);
  });
});

describe('estimateProfileEnvelopeVolumes', () => {
  const sketch: ProfileSketch = {
    kind: 'profile',
    width_m: 40,
    design_elevation_m: 152,
    chainage_points: [
      { chainage_m: 0, elevation_m: 150 },
      { chainage_m: 100, elevation_m: 150 },
    ],
  };

  it('adds envelope extra to strip fill on flat terrain', () => {
    const strip = estimateProfileVolumes(sketch);
    const withEnvelope = estimateProfileEnvelopeVolumes(sketch, 2, 3);
    expect(withEnvelope.fill_m3).toBeCloseTo(strip.fill_m3 + 560, 0);
    expect(withEnvelope.cut_m3).toBe(strip.cut_m3);
  });
});
