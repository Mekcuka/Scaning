import { describe, expect, it } from 'vitest';
import { map3dPublicUrl } from './map3dConfig';
import { gltfAssetDef, MAP3D_GLTF_ASSETS } from './map3dGltfAssets';

describe('map3dGltfAssets', () => {
  it('defines industrial asset set', () => {
    expect(Object.keys(MAP3D_GLTF_ASSETS).length).toBeGreaterThanOrEqual(10);
    expect(gltfAssetDef('oil-pump-jack')?.url).toContain('oil-pump-jack.glb');
    expect(gltfAssetDef('facility-large')?.url).toContain('.glb');
  });

  it('resolves model URLs under Vite base path', () => {
    const url = gltfAssetDef('transmission-tower')!.url;
    expect(url).toBe(map3dPublicUrl('map3d-models/transmission-tower.glb'));
    expect(url).toContain('map3d-models/transmission-tower.glb');
  });
});
