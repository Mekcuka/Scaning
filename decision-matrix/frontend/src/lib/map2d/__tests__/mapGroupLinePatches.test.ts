import { describe, expect, it } from 'vitest';
import type { InfraObject } from '../../api';
import {
  accumulateLineEndpointPatches,
  constrainGroupMovedLine,
  finalizeLinePayloadFromEndpoints,
  lineEndpointPatchesToResults,
} from '../mapGroupLinePatches';

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
  } as InfraObject;
}

describe('accumulateLineEndpointPatches', () => {
  it('updates both endpoints when two moved points share a line', () => {
    const pointA = infra({ id: 'a', subtype: 'gas_processing', lon: 56, lat: 38 });
    const pointB = infra({ id: 'b', subtype: 'gas_processing', lon: 57, lat: 39 });
    const line = infra({
      id: 'line-1',
      subtype: 'gas_pipeline',
      lon: 56,
      lat: 38,
      end_lon: 57,
      end_lat: 39,
      coordinates: [
        [56, 38],
        [57, 39],
      ],
    });
    const allInfra = [pointA, pointB, line];

    const acc = accumulateLineEndpointPatches(
      allInfra,
      [
        { id: 'a', oldLon: 56, oldLat: 38, newLon: 56.1, newLat: 38.1 },
        { id: 'b', oldLon: 57, oldLat: 39, newLon: 57.1, newLat: 39.1 },
      ],
      new Set(),
    );

    const results = lineEndpointPatchesToResults(acc);
    expect(results).toHaveLength(1);
    expect(results[0]!.payload.coordinates).toEqual([
      [56.1, 38.1],
      [57.1, 39.1],
    ]);
  });

  it('updates one endpoint when a single point moves', () => {
    const pointA = infra({ id: 'a', subtype: 'node', lon: 56, lat: 38 });
    const line = infra({
      id: 'line-1',
      subtype: 'autoroad',
      lon: 56,
      lat: 38,
      end_lon: 57,
      end_lat: 39,
    });
    const acc = accumulateLineEndpointPatches(
      [pointA, line],
      [{ id: 'a', oldLon: 56, oldLat: 38, newLon: 56.2, newLat: 38.2 }],
      new Set(),
    );
    const payload = finalizeLinePayloadFromEndpoints(acc.get('line-1')!);
    expect(payload.lon).toBe(56.2);
    expect(payload.lat).toBe(38.2);
    expect(payload.end_lon).toBe(57);
    expect(payload.end_lat).toBe(39);
  });

  it('skips lines included in the group selection', () => {
    const pointA = infra({ id: 'a', subtype: 'node', lon: 56, lat: 38 });
    const line = infra({
      id: 'line-1',
      subtype: 'autoroad',
      lon: 56,
      lat: 38,
      end_lon: 57,
      end_lat: 39,
    });
    const acc = accumulateLineEndpointPatches(
      [pointA, line],
      [{ id: 'a', oldLon: 56, oldLat: 38, newLon: 56.5, newLat: 38.5 }],
      new Set(['line-1']),
    );
    expect(lineEndpointPatchesToResults(acc)).toHaveLength(0);
  });
});

describe('constrainGroupMovedLine', () => {
  it('snaps moved endpoint to moved point and keeps other on anchor', () => {
    const anchor = infra({ id: 'b', subtype: 'gas_processing', lon: 57, lat: 39, name: 'GKS_B' });
    const moved = infra({ id: 'a', subtype: 'gas_processing', lon: 56, lat: 38, name: 'GKS_A' });
    const line = infra({
      id: 'line-1',
      subtype: 'gas_pipeline',
      lon: 56,
      lat: 38,
      end_lon: 57,
      end_lat: 39,
      coordinates: [
        [56, 38],
        [56.5, 38.5],
        [57, 39],
      ],
    });
    const draft = [
      [56.2, 38.2],
      [56.7, 38.7],
      [57.2, 39.2],
    ];
    const movedPositions = new Map([['a', { lon: 56.2, lat: 38.2 }]]);
    const result = constrainGroupMovedLine(line, draft, movedPositions, [anchor, moved, line]);
    expect(result[0]).toEqual([56.2, 38.2]);
    expect(result[result.length - 1]).toEqual([57, 39]);
  });
});
