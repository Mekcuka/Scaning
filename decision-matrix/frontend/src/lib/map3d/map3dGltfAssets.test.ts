import { describe, expect, it } from 'vitest';
import { gltfAssetDef, MAP3D_GLTF_ASSETS } from './map3dGltfAssets';

describe('map3dGltfAssets', () => {
  it('defines industrial asset set', () => {
    expect(Object.keys(MAP3D_GLTF_ASSETS).length).toBeGreaterThanOrEqual(8);
    expect(gltfAssetDef('facility-large')?.url).toContain('.glb');
  });
});
