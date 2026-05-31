import { describe, expect, it } from 'vitest';
import type { InfraObject } from '../api';
import { buildMap3dModelInstances } from './map3dModelInstances';

const pointObj: InfraObject = {
  id: 'pt-1',
  layer_id: 'l1',
  name: 'GKS',
  subtype: 'gas_processing',
  category: 'point',
  lon: 37.6,
  lat: 55.75,
  properties: {},
};

describe('buildMap3dModelInstances', () => {
  it('creates model instance for point infra', () => {
    const list = buildMap3dModelInstances({ infraObjects: [pointObj], pois: [] });
    expect(list).toHaveLength(1);
    expect(list[0]!.catalog.gltfAssetId).toBe('facility-large');
    expect(list[0]!.catalog.template).toBe('facility');
  });

  it('skips line subtypes', () => {
    const line: InfraObject = {
      ...pointObj,
      id: 'line-1',
      subtype: 'oil_pipeline',
      category: 'linear',
      coordinates: [
        [37.6, 55.75],
        [37.61, 55.76],
      ],
    };
    const list = buildMap3dModelInstances({ infraObjects: [line], pois: [] });
    expect(list).toHaveLength(0);
  });
});
