import { describe, expect, it, vi } from 'vitest';
import { buildMap3dLineLayerData } from '../map3dLineLayerData';
import { MAP3D_LINES_LAYER_ID } from '../map3dLinesLayer';

vi.mock('../map3dLineInstances', () => ({
  buildMap3dLineInstances: vi.fn(() => [{ id: 'tube-1' }]),
}));
vi.mock('../map3dPowerLineInstances', () => ({
  buildMap3dPowerLineInstances: vi.fn(() => [{ id: 'pl-1' }]),
}));

describe('buildMap3dLineLayerData', () => {
  it('aggregates tubes and power lines from builders', () => {
    const map = {} as import('maplibre-gl').Map;
    const data = buildMap3dLineLayerData(map, { infraObjects: [] });
    expect(data.tubes).toHaveLength(1);
    expect(data.powerLines).toHaveLength(1);
    expect(data.infraObjects).toEqual([]);
  });
});

describe('map3dLinesLayer constants', () => {
  it('exports stable layer id', () => {
    expect(MAP3D_LINES_LAYER_ID).toBe('dm-3d-lines');
  });
});
