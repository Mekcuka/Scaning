import { describe, expect, it } from 'vitest';
import type { InfraObject } from '../api';
import { buildMap3dLineInstances } from './map3dLineInstances';

function fakeMap(): import('maplibre-gl').Map {
  return { getTerrain: () => null } as import('maplibre-gl').Map;
}

const baseLine: InfraObject = {
  id: 'line-1',
  layer_id: 'layer-1',
  name: 'Pipe',
  subtype: 'gas_pipeline',
  category: 'linear',
  lon: 37.6,
  lat: 55.7,
  properties: {},
};

describe('buildMap3dLineInstances', () => {
  it('builds tube instances for line subtypes with coordinates', () => {
    const obj: InfraObject = {
      ...baseLine,
      coordinates: [
        [37.6, 55.7],
        [37.61, 55.71],
      ],
    };
    const instances = buildMap3dLineInstances(fakeMap(), {
      infraObjects: [obj],
    });
    expect(instances).toHaveLength(1);
    expect(instances[0]!.path).toHaveLength(2);
    expect(instances[0]!.radiusM).toBeGreaterThan(0);
  });

  it('skips invisible render_3d', () => {
    const obj: InfraObject = {
      ...baseLine,
      id: 'line-2',
      subtype: 'autoroad',
      coordinates: [
        [37.6, 55.7],
        [37.62, 55.72],
      ],
      properties: { render_3d_visible: false },
    };
    expect(
      buildMap3dLineInstances(fakeMap(), { infraObjects: [obj] }),
    ).toHaveLength(0);
  });
});
