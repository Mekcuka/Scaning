import { describe, expect, it } from 'vitest';
import {
  footprintCornersLonLat,
  footprintPolygonLonLat,
  resolveFootprintLonLat,
} from './padFootprintGeo';
import { makeInfraPoint } from '../test/fixtures/infra';

describe('padFootprintGeo', () => {
  it('footprintCornersLonLat returns four corners around center', () => {
    const corners = footprintCornersLonLat(37.62, 55.76, 100, 50, 0);
    expect(corners).toHaveLength(4);
    const lons = corners.map((c) => c[0]);
    const lats = corners.map((c) => c[1]);
    expect(Math.min(...lons)).toBeLessThan(37.62);
    expect(Math.max(...lons)).toBeGreaterThan(37.62);
    expect(Math.min(...lats)).toBeLessThan(55.76);
    expect(Math.max(...lats)).toBeGreaterThan(55.76);
  });

  it('footprint rotation changes corners', () => {
    const base = footprintCornersLonLat(0, 0, 100, 50, 0);
    const rotated = footprintCornersLonLat(0, 0, 100, 50, 45);
    expect(base).not.toEqual(rotated);
  });

  it('footprintPolygonLonLat maps vertices', () => {
    const ring = footprintPolygonLonLat(37.62, 55.76, [
      { east_m: 0, north_m: 0 },
      { east_m: 50, north_m: 0 },
      { east_m: 50, north_m: 30 },
    ]);
    expect(ring).toHaveLength(3);
    expect(ring[0]![0]).toBeCloseTo(37.62, 5);
  });

  it('resolveFootprintLonLat uses defaults for earthwork point', () => {
    const obj = makeInfraPoint({ subtype: 'substation', properties: {} });
    const ring = resolveFootprintLonLat(obj);
    expect(ring).not.toBeNull();
    expect(ring!.length).toBeGreaterThanOrEqual(4);
  });

  it('resolveFootprintLonLat returns null for node', () => {
    const obj = makeInfraPoint({ subtype: 'node' });
    expect(resolveFootprintLonLat(obj)).toBeNull();
  });

  it('resolveFootprintLonLat returns null for well bottomholes', () => {
    for (const subtype of [
      'well_bottomhole_nnb',
      'well_bottomhole_gs_heel',
      'well_bottomhole_gs_toe',
    ] as const) {
      expect(resolveFootprintLonLat(makeInfraPoint({ subtype }))).toBeNull();
    }
  });
});
