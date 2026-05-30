import { describe, expect, it } from 'vitest';
import type { InfraObject } from './api';
import { expandInfraDeleteIds, infraDeleteApiIds, linkedLineIdsForPoint } from './infraLinks';

function infra(overrides: Partial<InfraObject>): InfraObject {
  return {
    id: overrides.id ?? 'id',
    layer_id: overrides.layer_id ?? 'layer',
    name: overrides.name ?? 'obj',
    subtype: overrides.subtype ?? 'node',
    category: overrides.category ?? 'point',
    lon: overrides.lon ?? 56,
    lat: overrides.lat ?? 38,
    end_lon: overrides.end_lon ?? null,
    end_lat: overrides.end_lat ?? null,
    coordinates: overrides.coordinates ?? null,
    properties: overrides.properties ?? {},
  };
}

describe('linkedLineIdsForPoint', () => {
  it('returns connected line ids by start/end coordinates', () => {
    const point = infra({ id: 'p1', subtype: 'node', lon: 56.02, lat: 38.06 });
    const lineA = infra({
      id: 'l1',
      subtype: 'gas_pipeline',
      lon: 56.02,
      lat: 38.06,
      end_lon: 56.04,
      end_lat: 38.09,
      coordinates: [
        [56.02, 38.06],
        [56.04, 38.09],
      ],
    });
    const lineB = infra({
      id: 'l2',
      subtype: 'water_pipeline',
      lon: 56.01,
      lat: 38.01,
      end_lon: 56.02,
      end_lat: 38.06,
    });
    const lineC = infra({
      id: 'l3',
      subtype: 'power_line',
      lon: 55.9,
      lat: 38.2,
      end_lon: 55.8,
      end_lat: 38.3,
    });

    expect(linkedLineIdsForPoint(point, [point, lineA, lineB, lineC])).toEqual(['l1', 'l2']);
  });

  it('matches rounded endpoints for cascade delete compatibility', () => {
    const point = infra({ id: 'p2', subtype: 'node', lon: 56.02, lat: 38.06 });
    const nearRounded = infra({
      id: 'l4',
      subtype: 'autoroad',
      lon: 56.0203,
      lat: 38.0602,
      end_lon: 56.1,
      end_lat: 38.2,
    });
    const tooFar = infra({
      id: 'l5',
      subtype: 'autoroad',
      lon: 56.031,
      lat: 38.071,
      end_lon: 56.2,
      end_lat: 38.3,
    });

    expect(linkedLineIdsForPoint(point, [point, nearRounded, tooFar])).toEqual(['l4']);
  });
});

describe('infraDeleteApiIds', () => {
  it('deletes only the point when linked lines cascade on the backend', () => {
    const point = infra({ id: 'p1', subtype: 'node', lon: 56.02, lat: 38.06 });
    const line = infra({
      id: 'l1',
      subtype: 'gas_pipeline',
      lon: 56.02,
      lat: 38.06,
      end_lon: 56.04,
      end_lat: 38.09,
    });
    const all = [point, line];
    const cacheIds = expandInfraDeleteIds(['p1'], all);
    expect([...cacheIds]).toEqual(['p1', 'l1']);
    expect(infraDeleteApiIds(cacheIds, all)).toEqual(['p1']);
  });

  it('deletes standalone lines explicitly', () => {
    const line = infra({
      id: 'l1',
      subtype: 'autoroad',
      lon: 56,
      lat: 38,
      end_lon: 56.1,
      end_lat: 38.1,
    });
    expect(infraDeleteApiIds(['l1'], [line])).toEqual(['l1']);
  });
});

