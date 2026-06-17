import { describe, expect, it } from 'vitest';
import { InfraPointSnapIndex } from '../infraSnapIndex';
import type { InfraObject } from '../api';

function point(id: string, lon: number, lat: number): InfraObject {
  return {
    id,
    name: id,
    subtype: 'gas_processing',
    category: 'point',
    lon,
    lat,
    layer_id: 'layer-1',
    properties: {},
  } as InfraObject;
}

describe('InfraPointSnapIndex', () => {
  it('finds nearest point object within tolerance', () => {
    const index = new InfraPointSnapIndex([
      point('far', 37.0, 55.0),
      point('near', 37.6001, 55.7501),
    ]);
    const hit = index.nearest([37.6, 55.75], 0.3);
    expect(hit?.object.id).toBe('near');
    expect(hit!.distanceKm).toBeLessThan(0.3);
  });
});
