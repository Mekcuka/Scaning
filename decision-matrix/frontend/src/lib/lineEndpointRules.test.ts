import { describe, expect, it } from 'vitest';
import type { InfraObject } from './api';
import { nearestAllowedLineEndpoint, resolveLineEndpoint } from './lineEndpointRules';

const pointObj = (id: string, subtype: string, lon: number, lat: number): InfraObject =>
  ({
    id,
    name: `obj_${id}`,
    subtype,
    category: 'point',
    lon,
    lat,
    layer_id: 'layer-1',
    project_id: 'p1',
    properties: {},
  }) as InfraObject;

describe('nearestAllowedLineEndpoint', () => {
  it('snaps to nearest point object regardless of line subtype', () => {
    const objects = [pointObj('1', 'pad', 37.6, 55.75)];
    const nearest = nearestAllowedLineEndpoint('oil_pipeline', 'finish', [37.6001, 55.7501], objects);
    expect(nearest).not.toBeNull();
    expect(nearest!.object.subtype).toBe('pad');
    expect(nearest!.distanceKm).toBeLessThan(0.3);
  });

  it('plans node creation when no object within tolerance', () => {
    const objects = [pointObj('1', 'gas_processing', 37.6, 55.75)];
    const resolved = resolveLineEndpoint('autoroad', 'finish', [38.0, 56.0], objects);
    expect(resolved.ok).toBe(true);
    if (resolved.ok) {
      expect(resolved.createNode).toBe(true);
    }
  });
});
