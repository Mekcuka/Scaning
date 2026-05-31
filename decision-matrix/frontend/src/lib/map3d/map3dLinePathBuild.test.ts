import { describe, expect, it, vi } from 'vitest';
import type { InfraObject } from '../api';
import { LINE_SUBTYPES } from '../api';
import { buildMap3dLineInstances } from './map3dLineInstances';
import { buildMap3dPowerLineInstances } from './map3dPowerLineInstances';
import {
  buildNormalizedLinePath3d,
  PLAN_CORRIDOR_TERRAIN_BLEND,
} from './map3dLinePathBuild';

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

describe('buildNormalizedLinePath3d', () => {
  it('snaps start to pad for every linear subtype', () => {
    const pad = point('pad-1', 'pad', 37.6, 55.75);
    const node = point('node-1', 'node', 37.7, 55.85);

    for (const subtype of LINE_SUBTYPES) {
      const l = line(subtype, subtype, [
        [37.6001, 55.7501],
        [37.7001, 55.8501],
      ]);
      const built = buildNormalizedLinePath3d(fakeMap(), l, [pad, node], 0);
      expect(built, subtype).not.toBeNull();
      expect(built!.path[0], subtype).toEqual([37.6, 55.75]);
      expect(built!.path[built!.path.length - 1], subtype).toEqual([37.7, 55.85]);
    }
  });
});

describe('3D line builders use normalized paths for all subtypes', () => {
  const pad = point('pad-1', 'pad', 37.6, 55.75);
  const substation = point('ps-1', 'substation', 37.7, 55.85);

  const tubeSubtypes = LINE_SUBTYPES.filter((s) => s !== 'power_line');

  it.each(tubeSubtypes)('tube %s endpoints match point objects', (subtype) => {
    const l = line(`line-${subtype}`, subtype, [
      [37.6001, 55.7501],
      [37.7001, 55.8501],
    ]);
    const instances = buildMap3dLineInstances(fakeMap(), {
      infraObjects: [pad, substation, l],
    });
    expect(instances).toHaveLength(1);
    expect(instances[0]!.path[0]).toEqual([pad.lon, pad.lat]);
    expect(instances[0]!.path[1]).toEqual([substation.lon, substation.lat]);
  });

  it('power_line endpoints match point objects', () => {
    const l = line('pl-1', 'power_line', [
      [37.6001, 55.7501],
      [37.7001, 55.8501],
    ]);
    const instances = buildMap3dPowerLineInstances(fakeMap(), {
      infraObjects: [pad, substation, l],
    });
    expect(instances).toHaveLength(1);
    expect(instances[0]!.path[0]).toEqual([pad.lon, pad.lat]);
    expect(instances[0]!.path[1]).toEqual([substation.lon, substation.lat]);
    expect(instances[0]!.startWire.lon).toBe(pad.lon);
    expect(instances[0]!.finishWire.lon).toBe(substation.lon);
  });

  it('oil_pipeline between two nodes uses exact node coordinates', () => {
    const nodeA = point('n1', 'node', 37.6, 55.75);
    const nodeB = point('n2', 'node', 37.7, 55.85);
    const l = line('pipe-1', 'oil_pipeline', [
      [37.6001, 55.7501],
      [37.7001, 55.8501],
    ]);
    const instances = buildMap3dLineInstances(fakeMap(), {
      infraObjects: [nodeA, nodeB, l],
    });
    expect(instances[0]!.path[0]).toEqual([nodeA.lon, nodeA.lat]);
    expect(instances[0]!.path[1]).toEqual([nodeB.lon, nodeB.lat]);
  });

  it('water_pipeline snaps to network_node and methanol_joint', () => {
    const net = point('nn-1', 'network_node', 37.6, 55.75);
    const joint = point('mj-1', 'methanol_joint', 37.7, 55.85);
    const l = line('wp-1', 'water_pipeline', [
      [37.6001, 55.7501],
      [37.7001, 55.8501],
    ]);
    const built = buildNormalizedLinePath3d(fakeMap(), l, [net, joint], 0);
    expect(built!.path[0]).toEqual([net.lon, net.lat]);
    expect(built!.path[1]).toEqual([joint.lon, joint.lat]);
  });
});

describe('planCorridorAlts', () => {
  it('reduces interior vertex altitude spread vs raw terrain', async () => {
    const terrainMap = { getTerrain: () => ({}) } as import('maplibre-gl').Map;
    const modelsLayer = await import('./map3dModelsLayer');
    vi.spyOn(modelsLayer, 'altitudeForModelPlacement').mockImplementation(
      (_m, _lon, lat, baseM) => (lat === 55.76 ? baseM + 80 : baseM + 10),
    );

    const path: [number, number][] = [
      [37.6, 55.75],
      [37.61, 55.76],
      [37.62, 55.77],
    ];
    const withCorridor = buildNormalizedLinePath3d(
      terrainMap,
      line('c-1', 'oil_pipeline', path),
      [],
      0,
    );
    const without = buildNormalizedLinePath3d(
      terrainMap,
      line('c-2', 'oil_pipeline', path),
      [],
      0,
      undefined,
      { planCorridorAlts: false },
    );
    vi.restoreAllMocks();

    expect(withCorridor).not.toBeNull();
    expect(without).not.toBeNull();
    const spread = (alts: number[]) => Math.max(...alts) - Math.min(...alts);
    expect(spread(withCorridor!.alts)).toBeLessThan(spread(without!.alts));
    expect(PLAN_CORRIDOR_TERRAIN_BLEND).toBe(0.15);
  });
});
