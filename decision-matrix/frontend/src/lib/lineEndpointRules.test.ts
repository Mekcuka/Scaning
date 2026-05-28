import { describe, expect, it } from 'vitest';
import type { InfraObject } from './api';
import { nearestAllowedLineEndpoint, resolveLineEndpoint } from './lineEndpointRules';

const gks = (id: string, lon: number, lat: number): InfraObject =>
  ({
    id,
    name: `GKS_${id}`,
    subtype: 'gas_processing',
    category: 'point',
    lon,
    lat,
    layer_id: 'layer-1',
    project_id: 'p1',
    properties: {},
  }) as InfraObject;

describe('nearestAllowedLineEndpoint', () => {
  it('finds gas_processing within tolerance for gas_pipeline finish', () => {
    const objects = [gks('1', 37.6, 55.75)];
    const nearest = nearestAllowedLineEndpoint('gas_pipeline', 'finish', [37.6001, 55.7501], objects);
    expect(nearest).not.toBeNull();
    expect(nearest!.object.id).toBe('1');
    expect(nearest!.distanceKm).toBeLessThan(0.3);
  });

  it('plans node creation when no object within tolerance', () => {
    const objects = [gks('1', 37.6, 55.75)];
    const resolved = resolveLineEndpoint('gas_pipeline', 'finish', [38.0, 56.0], objects);
    expect(resolved.ok).toBe(true);
    if (resolved.ok) {
      expect(resolved.createNode).toBe(true);
    }
  });
});
