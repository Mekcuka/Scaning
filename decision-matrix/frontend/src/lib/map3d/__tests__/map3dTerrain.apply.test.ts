import { afterEach, describe, expect, it, vi } from 'vitest';
import { MAP3D_LAYER_IDS, MAP3D_SOURCE_IDS } from '../map3dConfig';
import { applyMap3dTerrain, removeMap3dTerrain } from '../map3dTerrain';
import { createMockMapLibre } from '../test/mockMapLibre';

describe('removeMap3dTerrain', () => {
  it('clears terrain, hillshade layer, and DEM source', () => {
    const { map, state } = createMockMapLibre({
      layers: [MAP3D_LAYER_IDS.hillshade],
      sources: [MAP3D_SOURCE_IDS.terrain],
    });
    state.terrain = { source: MAP3D_SOURCE_IDS.terrain };

    removeMap3dTerrain(map);

    expect(map.setTerrain).toHaveBeenCalledWith(null);
    expect(map.removeLayer).toHaveBeenCalledWith(MAP3D_LAYER_IDS.hillshade);
    expect(map.removeSource).toHaveBeenCalledWith(MAP3D_SOURCE_IDS.terrain);
    expect(state.sources.has(MAP3D_SOURCE_IDS.terrain)).toBe(false);
  });
});

describe('applyMap3dTerrain', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('removes terrain when disabled even if DEM was present', () => {
    vi.stubEnv('VITE_MAPTILER_KEY', 'test-key');
    const { map, state } = createMockMapLibre({
      layers: [MAP3D_LAYER_IDS.hillshade],
      sources: [MAP3D_SOURCE_IDS.terrain],
    });
    state.terrain = { source: MAP3D_SOURCE_IDS.terrain };

    const ok = applyMap3dTerrain(map, false);

    expect(ok).toBe(false);
    expect(map.setTerrain).toHaveBeenCalledWith(null);
    expect(state.sources.has(MAP3D_SOURCE_IDS.terrain)).toBe(false);
  });

  it('removes terrain when MapTiler key is missing', () => {
    vi.stubEnv('VITE_MAPTILER_KEY', '');
    const { map, state } = createMockMapLibre({
      layers: [MAP3D_LAYER_IDS.hillshade],
      sources: [MAP3D_SOURCE_IDS.terrain],
    });

    const ok = applyMap3dTerrain(map, true);

    expect(ok).toBe(false);
    expect(state.sources.has(MAP3D_SOURCE_IDS.terrain)).toBe(false);
  });

  it('adds DEM source and terrain when enabled and key present', () => {
    vi.stubEnv('VITE_MAPTILER_KEY', 'test-key');
    const { map, state } = createMockMapLibre();

    const ok = applyMap3dTerrain(map, true, 1.5);

    expect(ok).toBe(true);
    expect(state.sources.has(MAP3D_SOURCE_IDS.terrain)).toBe(true);
    expect(map.setTerrain).toHaveBeenCalledWith({
      source: MAP3D_SOURCE_IDS.terrain,
      exaggeration: 1.5,
    });
  });
});
