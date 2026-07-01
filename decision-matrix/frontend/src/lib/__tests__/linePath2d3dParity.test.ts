import { describe, expect, it } from 'vitest';
import { LINE_SUBTYPES, type InfraObject } from '../api';
import { getLineCoordinates, linePathForDisplay, linePathsEqual } from '../infraGeometry';
import { buildMap3dGeoJson } from '../map3d/geoJson';
import { buildMap3dLineInstances } from '../map3d/map3dLineInstances';
import { buildMap3dPowerLineInstances } from '../map3d/map3dPowerLineInstances';
import { buildNormalizedLinePath3d } from '../map3d/map3dLinePathBuild';
import { isBottomholeSubtype } from '../wellBottomholeProperties';

function fakeMap(): import('maplibre-gl').Map {
  return { getTerrain: () => null } as import('maplibre-gl').Map;
}

const point = (id: string, subtype: string, lon: number, lat: number): InfraObject =>
  ({
    id,
    name: id,
    subtype,
    category: 'point',
    lon,
    lat,
    layer_id: 'layer-1',
    project_id: 'p1',
    properties: {},
  }) as InfraObject;

const line = (
  id: string,
  subtype: string,
  coords: [number, number][],
): InfraObject =>
  ({
    id,
    name: id,
    subtype,
    category: 'linear',
    lon: coords[0]![0],
    lat: coords[0]![1],
    end_lon: coords[coords.length - 1]![0],
    end_lat: coords[coords.length - 1]![1],
    coordinates: coords,
    layer_id: 'layer-1',
    project_id: 'p1',
    properties: {},
  }) as InfraObject;

function expectSamePathEverywhere(
  obj: InfraObject,
  pool: InfraObject[],
  filtered: InfraObject[],
) {
  const path2d = linePathForDisplay(obj, pool);
  expect(path2d).not.toBeNull();

  const built = buildNormalizedLinePath3d(fakeMap(), obj, filtered, 0, pool);
  expect(linePathsEqual(path2d, built?.path)).toBe(true);

  const bundle = buildMap3dGeoJson({ infraObjects: filtered, pois: [], snapPool: pool });
  const gj = bundle.infraLines.features.find((f) => f.id === obj.id);
  expect(gj).toBeDefined();
  expect(linePathsEqual(path2d, gj!.geometry.coordinates as [number, number][])).toBe(true);

  if (obj.subtype === 'power_line') {
    const pl = buildMap3dPowerLineInstances(fakeMap(), {
      infraObjects: filtered,
      snapPool: pool,
    });
    expect(pl).toHaveLength(1);
    expect(linePathsEqual(path2d, pl[0]!.path)).toBe(true);
  } else if (isBottomholeSubtype(obj.subtype)) {
    // Legacy GS line — rendered via bottomhole 3D layer, not tube instances.
    expect(buildMap3dLineInstances(fakeMap(), { infraObjects: filtered, snapPool: pool })).toHaveLength(
      0,
    );
  } else {
    const tubes = buildMap3dLineInstances(fakeMap(), {
      infraObjects: filtered,
      snapPool: pool,
    });
    expect(tubes).toHaveLength(1);
    expect(linePathsEqual(path2d, tubes[0]!.path)).toBe(true);
  }
}

describe('line path 2D/3D vertex parity', () => {
  const pad = point('pad-1', 'oil_pad', 37.6, 55.75);
  const node = point('node-1', 'node', 37.7, 55.85);
  const substation = point('ps-1', 'substation', 37.72, 55.88);

  it.each(LINE_SUBTYPES)('%s: 2D path = 3D path = GeoJSON (snapped ends)', (subtype) => {
    const l = line(
      `line-${subtype}`,
      subtype,
      [
        [37.6001, 55.7501],
        [37.65, 55.8],
        [37.7001, 55.8501],
      ],
    );
    const pool = [pad, node, substation, l];
    expectSamePathEverywhere(l, pool, pool);
  });

  it('uses full snapPool when line is only in filtered infraObjects', () => {
    const l = line('pipe-1', 'oil_pipeline', [
      [37.6001, 55.7501],
      [37.65, 55.8],
      [37.7001, 55.8501],
    ]);
    const pool = [pad, node, l];
    expectSamePathEverywhere(l, pool, [l]);
    expect(linePathForDisplay(l, pool)![0]).toEqual([pad.lon, pad.lat]);
    expect(linePathForDisplay(l, pool)![2]).toEqual([node.lon, node.lat]);
  });

  it('preserves interior vertices (only ends snap)', () => {
    const mid: [number, number] = [37.61, 55.751];
    const l = line('mp-1', 'methanol_pipeline', [
      [37.6001, 55.7501],
      mid,
      [37.7001, 55.8501],
    ]);
    const pool = [pad, node, l];
    const path = linePathForDisplay(l, pool)!;
    expect(path[1]).toEqual(mid);
    const built = buildNormalizedLinePath3d(fakeMap(), l, [l], 0, pool);
    expect(built!.path[1]).toEqual(mid);
  });

  it('two-vertex line from end_lon/end_lat matches coordinates[]', () => {
    const l = line('pl-2', 'power_line', [
      [37.6001, 55.7501],
      [37.7001, 55.8501],
    ]);
    const pool = [pad, node, l];
    const path = linePathForDisplay(l, pool)!;
    const raw = getLineCoordinates(l)!;
    expect(path.length).toBe(raw.length);
    expect(path[0]).toEqual([pad.lon, pad.lat]);
    expect(path[path.length - 1]).toEqual([node.lon, node.lat]);
  });
});
