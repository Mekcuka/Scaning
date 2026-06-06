import { describe, expect, it } from 'vitest';
import type { InfraObject } from '../api';
import { setProjectCustomGltfAssets } from './map3dCustomAssets';
import { buildMap3dModelInstances } from './map3dModelInstances';
import { RENDER_3D_MODEL_ID_KEY } from './render3d';

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

  it('uses assigned custom GLB id instead of subtype default', () => {
    setProjectCustomGltfAssets('proj-1', [
      {
        id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        project_id: 'proj-1',
        filename: 'tower.glb',
        target_height_m: 12,
        created_at: '2026-01-01T00:00:00Z',
        assigned_subtypes: ['node'],
      },
    ]);
    const node: InfraObject = {
      ...pointObj,
      id: 'node-1',
      subtype: 'node',
      properties: {
        [RENDER_3D_MODEL_ID_KEY]: 'custom:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        render_3d_style: 'model',
      },
    };
    const list = buildMap3dModelInstances({ infraObjects: [node], pois: [] });
    expect(list).toHaveLength(1);
    expect(list[0]!.catalog.gltfAssetId).toBe('custom:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
  });
});
