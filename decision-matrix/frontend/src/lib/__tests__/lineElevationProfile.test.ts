import { describe, expect, it } from 'vitest';

import {
  buildLineProfileTableRows,
  clampLineProfileStepM,
  formatChainageM,
  formatLineProfileDemSource,
  formatLineProfilePointsCount,
  formatPicket,
  isSyntheticLineProfileDem,
  parseLineProfileFromObject,
  readLineProfileTotalLengthM,
  slopePermilleBetween,
} from '../lineElevationProfile';
import type { InfraObject } from '../api';

describe('lineElevationProfile', () => {
  it('clampLineProfileStepM enforces range', () => {
    expect(clampLineProfileStepM(5)).toBe(10);
    expect(clampLineProfileStepM(100)).toBe(100);
    expect(clampLineProfileStepM(2000)).toBe(1000);
    expect(clampLineProfileStepM('abc')).toBe(100);
  });

  it('formatPicket uses Russian chainage style', () => {
    expect(formatPicket(0)).toBe('0+000');
    expect(formatPicket(125)).toBe('1+025');
    expect(formatPicket(437.3)).toBe('4+37,3');
    expect(formatPicket(1437.3)).toBe('14+37,3');
    expect(formatPicket(100)).toBe('1+000');
    expect(formatPicket(200)).toBe('2+000');
  });

  it('formatChainageM uses ru-RU with fractional meters', () => {
    expect(formatChainageM(100)).toBe('100');
    expect(formatChainageM(1437.3)).toMatch(/1\s437,3/);
    expect(formatChainageM(437.345)).toBe('437,345');
  });

  it('slopePermilleBetween computes grade', () => {
    const slope = slopePermilleBetween(
      { chainage_m: 0, lon: 0, lat: 0, elevation_m: 100 },
      { chainage_m: 100, lon: 0, lat: 0, elevation_m: 101 },
    );
    expect(slope).toBe(10);
  });

  it('buildLineProfileTableRows adds picket and slope', () => {
    const rows = buildLineProfileTableRows([
      { chainage_m: 0, lon: 37, lat: 55, elevation_m: 100 },
      { chainage_m: 100, lon: 37.001, lat: 55, elevation_m: 101 },
      { chainage_m: 1437.3, lon: 37.01, lat: 55, elevation_m: 102 },
    ]);
    expect(rows).toHaveLength(3);
    expect(rows[0]!.picket).toBe('0+000');
    expect(rows[0]!.slope_permille).toBeNull();
    expect(rows[1]!.slope_permille).toBe(10);
    expect(rows[2]!.picket).toBe('14+37,3');
  });

  it('formatLineProfileDemSource maps known and generic sources', () => {
    expect(formatLineProfileDemSource('synthetic:dev_flat')).toBe('Синтетический ЦМР (dev)');
    expect(formatLineProfileDemSource('opentopography:COP30')).toBe('OpenTopography COP30');
    expect(formatLineProfileDemSource('opentopography:SRTMGL1')).toBe('OpenTopography SRTMGL1');
    expect(formatLineProfileDemSource('custom')).toBe('custom');
  });

  it('isSyntheticLineProfileDem detects synthetic prefix', () => {
    expect(isSyntheticLineProfileDem('synthetic:dev_flat')).toBe(true);
    expect(isSyntheticLineProfileDem('opentopography:COP30')).toBe(false);
  });

  it('formatLineProfilePointsCount uses Russian plural forms', () => {
    expect(formatLineProfilePointsCount(1)).toBe('1 точка');
    expect(formatLineProfilePointsCount(2)).toBe('2 точки');
    expect(formatLineProfilePointsCount(5)).toBe('5 точек');
    expect(formatLineProfilePointsCount(11)).toBe('11 точек');
  });

  it('readLineProfileTotalLengthM returns total_length_m from valid profile', () => {
    const obj = {
      id: 'line-1',
      properties: {
        line_elevation_profile_json: {
          step_m: 100,
          computed_at: '2026-01-01T00:00:00Z',
          dem_source: 'synthetic:dev_flat',
          total_length_m: 1437.3,
          points: [{ chainage_m: 0, lon: 37, lat: 55, elevation_m: 100 }],
        },
      },
    } as InfraObject;

    expect(parseLineProfileFromObject(obj)?.total_length_m).toBe(1437.3);
    expect(readLineProfileTotalLengthM(obj)).toBe(1437.3);
  });

  it('readLineProfileTotalLengthM returns null without profile', () => {
    expect(readLineProfileTotalLengthM(null)).toBeNull();
    expect(readLineProfileTotalLengthM({ id: 'x', properties: {} } as InfraObject)).toBeNull();
    expect(
      readLineProfileTotalLengthM({
        id: 'x',
        properties: {
          line_elevation_profile_json: {
            total_length_m: 100,
            points: [],
          },
        },
      } as InfraObject),
    ).toBeNull();
  });
});
