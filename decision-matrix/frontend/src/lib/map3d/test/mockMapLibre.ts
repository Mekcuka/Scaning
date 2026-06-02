import { vi } from 'vitest';
import type { Map as MapLibreMap } from 'maplibre-gl';

type MockMapState = {
  layers: Set<string>;
  sources: Set<string>;
  styleLayers: { id: string }[];
  terrain: unknown;
  layoutVisibility: Record<string, string>;
};

export type MockMapLibre = {
  map: MapLibreMap;
  state: MockMapState;
};

export function createMockMapLibre(
  initial?: Partial<{ layers: string[]; sources: string[]; styleLayers: { id: string }[] }>,
): MockMapLibre {
  const state: MockMapState = {
    layers: new Set(initial?.layers ?? []),
    sources: new Set(initial?.sources ?? []),
    styleLayers: [...(initial?.styleLayers ?? [{ id: 'dm-thresholds' }])],
    terrain: null,
    layoutVisibility: {},
  };

  const map = {
    getLayer: vi.fn((id: string) => (state.layers.has(id) ? { id } : undefined)),
    getSource: vi.fn((id: string) => (state.sources.has(id) ? { id } : undefined)),
    addSource: vi.fn((id: string) => {
      state.sources.add(id);
    }),
    removeSource: vi.fn((id: string) => {
      state.sources.delete(id);
    }),
    addLayer: vi.fn((spec: { id: string }) => {
      state.layers.add(spec.id);
    }),
    removeLayer: vi.fn((id: string) => {
      state.layers.delete(id);
    }),
    setLayoutProperty: vi.fn((id: string, _prop: string, value: string) => {
      state.layoutVisibility[id] = value;
    }),
    getStyle: vi.fn(() => ({ layers: state.styleLayers })),
    setTerrain: vi.fn((terrain: unknown) => {
      state.terrain = terrain;
    }),
    getTerrain: vi.fn(() => state.terrain),
  };

  return { map: map as unknown as MapLibreMap, state };
}
