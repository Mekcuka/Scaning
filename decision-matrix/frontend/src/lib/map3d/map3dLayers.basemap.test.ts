import { describe, expect, it } from 'vitest';
import { ESRI_WORLD_IMAGERY_URL } from './map3dBasemap';
import { MAP3D_LAYER_IDS, MAP3D_SOURCE_IDS } from './map3dConfig';
import { setBasemapVisibility, syncMap3dBasemap } from './map3dLayers';
import { createMockMapLibre } from './test/mockMapLibre';

describe('syncMap3dBasemap', () => {
  it('adds raster source and layer when enabled and absent', () => {
    const { map, state } = createMockMapLibre();

    syncMap3dBasemap(map, true);

    expect(state.sources.has(MAP3D_SOURCE_IDS.basemap)).toBe(true);
    expect(state.layers.has(MAP3D_LAYER_IDS.basemap)).toBe(true);
    expect(map.addSource).toHaveBeenCalledWith(
      MAP3D_SOURCE_IDS.basemap,
      expect.objectContaining({
        type: 'raster',
        tiles: [ESRI_WORLD_IMAGERY_URL],
      }),
    );
  });

  it('sets visibility visible when layer already exists', () => {
    const { map } = createMockMapLibre({
      layers: [MAP3D_LAYER_IDS.basemap],
      sources: [MAP3D_SOURCE_IDS.basemap],
    });

    syncMap3dBasemap(map, true);

    expect(map.setLayoutProperty).toHaveBeenCalledWith(
      MAP3D_LAYER_IDS.basemap,
      'visibility',
      'visible',
    );
    expect(map.addSource).not.toHaveBeenCalled();
  });

  it('removes layer and source when disabled (no visibility-only hide)', () => {
    const { map, state } = createMockMapLibre({
      layers: [MAP3D_LAYER_IDS.basemap],
      sources: [MAP3D_SOURCE_IDS.basemap],
    });

    syncMap3dBasemap(map, false);

    expect(map.removeLayer).toHaveBeenCalledWith(MAP3D_LAYER_IDS.basemap);
    expect(map.removeSource).toHaveBeenCalledWith(MAP3D_SOURCE_IDS.basemap);
    expect(state.layers.has(MAP3D_LAYER_IDS.basemap)).toBe(false);
    expect(state.sources.has(MAP3D_SOURCE_IDS.basemap)).toBe(false);
  });

  it('is a no-op remove when basemap already absent', () => {
    const { map, state } = createMockMapLibre();

    syncMap3dBasemap(map, false);

    expect(map.removeLayer).not.toHaveBeenCalled();
    expect(map.removeSource).not.toHaveBeenCalled();
    expect(state.layers.size).toBe(0);
    expect(state.sources.size).toBe(0);
  });

  it('setBasemapVisibility delegates to syncMap3dBasemap', () => {
    const { map, state } = createMockMapLibre({
      layers: [MAP3D_LAYER_IDS.basemap],
      sources: [MAP3D_SOURCE_IDS.basemap],
    });

    setBasemapVisibility(map, false);

    expect(state.sources.has(MAP3D_SOURCE_IDS.basemap)).toBe(false);
  });
});
