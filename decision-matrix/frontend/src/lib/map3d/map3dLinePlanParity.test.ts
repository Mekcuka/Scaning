import { describe, expect, it } from 'vitest';
import type { InfraObject } from '../api';
import { linePathForDisplay } from '../infraGeometry';
import { buildMap3dGeoJson } from './geoJson';
import { buildNormalizedLinePath3d } from './map3dLinePathBuild';
import {
  interiorCornerBulgesOppositeToChord,
  maxVertexDeviationFromTubeM,
  middleVertexTubeDeviationM,
} from './map3dLinePlanParity';

function fakeMap(): import('maplibre-gl').Map {
  return { getTerrain: () => null } as import('maplibre-gl').Map;
}

const line3 = (
  coords: [number, number][],
): InfraObject =>
  ({
    id: 'line-3v',
    name: 'test',
    subtype: 'methanol_pipeline',
    category: 'linear',
    lon: coords[0]![0],
    lat: coords[0]![1],
    end_lon: coords[2]![0],
    end_lat: coords[2]![1],
    coordinates: coords,
    layer_id: 'layer-1',
    project_id: 'p1',
    properties: {},
  }) as InfraObject;

/** Concave corner: middle vertex offset perpendicular to chord (local “inward”). */
const CONCAVE_PATH: [number, number][] = [
  [37.6, 55.75],
  [37.61, 55.751],
  [37.62, 55.75],
];

describe('map3dLinePlanParity', () => {
  it('tube centerline passes within 1m of every vertex (3-point path)', () => {
    const alts = [0, 0, 0];
    expect(maxVertexDeviationFromTubeM(CONCAVE_PATH, alts)).toBeLessThan(1);
    expect(middleVertexTubeDeviationM(CONCAVE_PATH, alts)).toBeLessThan(1);
  });

  it('does not bulge to opposite side of chord (anti-Catmull-Rom)', () => {
    const alts = [0, 0, 0];
    expect(interiorCornerBulgesOppositeToChord(CONCAVE_PATH, alts)).toBe(false);
  });

  it('steep terrain alts still keep plan through vertices', () => {
    const alts = [0, 80, 5];
    expect(maxVertexDeviationFromTubeM(CONCAVE_PATH, alts)).toBeLessThan(1);
  });
});

describe('2D / 3D / GeoJSON path parity', () => {
  const pad = {
    id: 'oil_pad',
    subtype: 'oil_pad',
    lon: 37.6,
    lat: 55.75,
  } as InfraObject;
  const node = {
    id: 'node',
    subtype: 'node',
    lon: 37.62,
    lat: 55.75,
  } as InfraObject;
  const raw = line3([
    [37.6001, 55.7501],
    [37.61, 55.751],
    [37.6201, 55.7501],
  ]);
  const pool = [pad, node, raw];

  it('linePathForDisplay, buildNormalizedLinePath3d, and geoJson share snapped path', () => {
    const display = linePathForDisplay(raw, pool);
    const built = buildNormalizedLinePath3d(fakeMap(), raw, pool, 0, pool);
    const bundle = buildMap3dGeoJson({ infraObjects: [raw], pois: [], snapPool: pool });
    expect(display).not.toBeNull();
    expect(built).not.toBeNull();
    expect(display).toEqual(built!.path);
    expect(bundle.infraLines.features[0]!.geometry.coordinates).toEqual(display);
  });
});
