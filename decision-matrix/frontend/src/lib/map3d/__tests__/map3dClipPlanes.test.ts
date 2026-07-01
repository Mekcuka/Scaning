import { describe, expect, it, vi } from 'vitest';
import { MAP3D_CLIP_FAR_M } from '../map3dConfig';
import { applyMap3dExtendedClipPlanes, clearMap3dExtendedClipPlanes } from '../map3dClipPlanes';

describe('map3dClipPlanes', () => {
  it('extends MapLibre near/far for deep underground geometry', () => {
    const overrideNearFarZ = vi.fn();
    const clearNearFarZOverride = vi.fn();
    const map = {
      getCanvas: () => ({ height: 800 }),
      transform: { overrideNearFarZ, clearNearFarZOverride },
    };

    applyMap3dExtendedClipPlanes(map as never);
    expect(overrideNearFarZ).toHaveBeenCalledWith(16, MAP3D_CLIP_FAR_M);

    clearMap3dExtendedClipPlanes(map as never);
    expect(clearNearFarZOverride).toHaveBeenCalled();
  });
});
