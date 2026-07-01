import { describe, expect, it } from 'vitest';
import {
  MAP3D_MODELS_LAYER_ID,
  removeMap3dModelsLayer,
} from '../map3dModelsLayer';
import { createMockMapLibre } from '../test/mockMapLibre';

describe('removeMap3dModelsLayer', () => {
  it('removes layer from map when present', () => {
    const { map, state } = createMockMapLibre({ layers: [MAP3D_MODELS_LAYER_ID] });
    removeMap3dModelsLayer(map);
    expect(map.removeLayer).toHaveBeenCalledWith(MAP3D_MODELS_LAYER_ID);
    expect(state.layers.has(MAP3D_MODELS_LAYER_ID)).toBe(false);
  });

  it('is a no-op when layer is absent', () => {
    const { map } = createMockMapLibre();
    removeMap3dModelsLayer(map);
    expect(map.removeLayer).not.toHaveBeenCalled();
  });
});
