import { describe, expect, it } from 'vitest';
import type { InfraObject } from './api';
import {
  buildLineSplitPlan,
  closestPointOnPolyline,
  findLineSplitAtPoint,
  splitLineCoordinatesAt,
} from './lineSplit';

const line = (over: Partial<InfraObject>): InfraObject =>
  ({
    id: 'line-1',
    name: 'Дорога_1',
    subtype: 'autoroad',
    layer_id: 'layer-1',
    lon: 37.6,
    lat: 55.75,
    end_lon: 37.62,
    end_lat: 55.76,
    coordinates: [
      [37.6, 55.75],
      [37.61, 55.755],
      [37.62, 55.76],
    ],
    properties: {
      coordinates: [
        [37.6, 55.75],
        [37.61, 55.755],
        [37.62, 55.76],
      ],
    },
    ...over,
  }) as InfraObject;

describe('closestPointOnPolyline', () => {
  it('returns midpoint on segment', () => {
    const hit = closestPointOnPolyline([37.605, 55.7525], [
      [37.6, 55.75],
      [37.61, 55.755],
    ]);
    expect(hit).not.toBeNull();
    expect(hit!.segmentIndex).toBe(0);
    expect(hit!.distanceKm).toBeLessThan(0.001);
  });

  it('rejects point too close to endpoint', () => {
    const hit = closestPointOnPolyline([37.6, 55.75], [
      [37.6, 55.75],
      [37.61, 55.755],
    ]);
    expect(hit).toBeNull();
  });
});

describe('splitLineCoordinatesAt', () => {
  it('splits polyline into two parts', () => {
    const parts = splitLineCoordinatesAt(
      [
        [37.6, 55.75],
        [37.61, 55.755],
        [37.62, 55.76],
      ],
      0,
      [37.605, 55.7525],
    );
    expect(parts).not.toBeNull();
    const [first, second] = parts!;
    expect(first).toHaveLength(2);
    expect(second).toHaveLength(3);
    expect(first[1]).toEqual(second[0]);
  });
});

describe('findLineSplitAtPoint', () => {
  it('finds nearest line within tolerance', () => {
    const found = findLineSplitAtPoint([37.605, 55.7525], [line({})], 0.3);
    expect(found?.line.id).toBe('line-1');
  });

  it('returns null when far from lines', () => {
    expect(findLineSplitAtPoint([38, 56], [line({})], 0.01)).toBeNull();
  });
});

describe('buildLineSplitPlan', () => {
  it('builds two line payloads', () => {
    const plan = buildLineSplitPlan(line({}), 0, 37.605, 55.7525, 'Дорога_1 (2)');
    expect(plan).not.toBeNull();
    expect(plan!.firstPayload.coordinates).toHaveLength(2);
    expect(plan!.secondPayload.coordinates).toHaveLength(3);
    expect(plan!.secondPayload.name).toBe('Дорога_1 (2)');
    expect(plan!.firstPayload).not.toHaveProperty('properties');
    expect(plan!.secondPayload.properties?.coordinates).toBeUndefined();
  });
});
