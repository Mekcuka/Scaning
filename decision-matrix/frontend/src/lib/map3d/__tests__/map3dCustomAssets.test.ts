import { describe, expect, it, vi } from 'vitest';
import {
  customModelPropertyId,
  getCustomGltfAssetsRevision,
  resolveGltfAssetDef,
  setProjectCustomGltfAssets,
  subscribeCustomGltfAssets,
} from '../map3dCustomAssets';

describe('map3dCustomAssets', () => {
  it('registers custom models and resolves by custom: id', () => {
    setProjectCustomGltfAssets('proj-1', [
      {
        id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        project_id: 'proj-1',
        filename: 'tower.glb',
        target_height_m: 12,
        created_at: '2026-01-01T00:00:00Z',
        assigned_subtypes: [],
      },
    ]);
    const key = customModelPropertyId('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    expect(key).toBe('custom:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    const def = resolveGltfAssetDef(key);
    expect(def).not.toBeNull();
    expect(def!.url).toContain('/projects/proj-1/map3d-custom-models/');
    expect(def!.targetHeightM).toBe(12);
  });

  it('falls back to bundled assets', () => {
    setProjectCustomGltfAssets('proj-1', []);
    expect(resolveGltfAssetDef('tank')?.url).toContain('tank.glb');
  });

  it('notifies subscribers when registry changes', () => {
    const listener = vi.fn();
    const before = getCustomGltfAssetsRevision();
    const unsub = subscribeCustomGltfAssets(listener);
    setProjectCustomGltfAssets('proj-1', []);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(getCustomGltfAssetsRevision()).toBe(before + 1);
    unsub();
  });
});
