import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MAP3D_SOURCE_IDS } from '../lib/map3d/map3dConfig';

const mapLoadHandlers = vi.hoisted(() => [] as Array<() => void>);
const createdMapOptions = vi.hoisted(() => [] as Array<{ style: unknown }>);

const ensureMap3dModelsLayer = vi.hoisted(() => vi.fn());
const syncMap3dBasemap = vi.hoisted(() => vi.fn());
const applyMap3dTerrain = vi.hoisted(() => vi.fn(() => false));
const addMap3dVectorLayers = vi.hoisted(() => vi.fn());
const ensureMap3dLinesLayer = vi.hoisted(() => vi.fn());
const buildMap3dLineLayerData = vi.hoisted(() =>
  vi.fn(() => ({ tubes: [], powerLines: [], infraObjects: [] })),
);
const buildMap3dModelInstances = vi.hoisted(() => vi.fn(() => []));

vi.mock('maplibre-gl', () => {
  class NavigationControl {}

  class MockMap {
    handlers: Record<string, Array<(...args: unknown[]) => void>> = {};
    options: { style: unknown };

    constructor(options: { style: unknown }) {
      this.options = options;
      createdMapOptions.push({ style: options.style });
    }

    on(event: string, cb: () => void) {
      this.handlers[event] = this.handlers[event] ?? [];
      this.handlers[event].push(cb);
      if (event === 'load') mapLoadHandlers.push(cb);
    }

    addControl() {}
    isStyleLoaded() {
      return true;
    }
    getLayer() {
      return undefined;
    }
    getSource() {
      return undefined;
    }
    getCenter() {
      return { lng: 37.6, lat: 55.75 };
    }
    getZoom() {
      return 10;
    }
    getPitch() {
      return 60;
    }
    getBearing() {
      return 0;
    }
    remove() {}
  }

  return {
    default: {
      Map: MockMap,
      NavigationControl,
    },
  };
});

vi.mock('maplibre-gl/dist/maplibre-gl.css', () => ({}));

vi.mock('../lib/mapViewState', () => ({
  resolveInitialMapView3d: () => ({
    centerLon: 37.6,
    centerLat: 55.75,
    zoom: 10,
    pitch: 60,
    bearing: 0,
  }),
  saveMapViewState3d: vi.fn(),
}));

vi.mock('../store', () => ({
  useAppStore: (selector: (s: { currentProjectId: string }) => unknown) =>
    selector({ currentProjectId: 'p1' }),
}));

vi.mock('../lib/map3d/map3dBasemap', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/map3d/map3dBasemap')>();
  return {
    ...actual,
    createMap3dBaseStyle: vi.fn((opts?: { includeBasemap?: boolean }) =>
      actual.createMap3dBaseStyle(opts),
    ),
  };
});

vi.mock('../lib/map3d/map3dLayers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/map3d/map3dLayers')>();
  return {
    ...actual,
    syncMap3dBasemap,
    addMap3dVectorLayers,
    getMap3dInteractiveLayerIds: () => [],
    setMap3dInfraLinesPickOnly: vi.fn(),
    setMap3dPointSymbolsVisibility: vi.fn(),
  };
});

vi.mock('../lib/map3d/map3dTerrain', () => ({
  applyMap3dTerrain,
  DEFAULT_TERRAIN_EXAGGERATION: 1.2,
}));

vi.mock('../lib/map3d/map3dAtmosphere', () => ({
  applyMap3dAtmosphere: vi.fn(),
}));

vi.mock('../lib/map3d/map3dLinesLayer', () => ({
  ensureMap3dLinesLayer,
  Map3dLinesCustomLayer: class {
    id = 'dm-3d-lines';
    setInstances = vi.fn();
  },
  setMap3dLinesLayerVisible: vi.fn(),
}));

vi.mock('../lib/map3d/map3dModelsLayer', () => ({
  ensureMap3dModelsLayer,
  Map3dModelsCustomLayer: class {
    id = 'dm-3d-models';
    setInstances = vi.fn();
    setVisible = vi.fn();
  },
  setMap3dModelsLayerVisible: vi.fn(),
}));

vi.mock('../lib/map3d/map3dLineLayerData', () => ({
  buildMap3dLineLayerData,
}));

vi.mock('../lib/map3d/map3dModelInstances', () => ({
  buildMap3dModelInstances,
}));

vi.mock('../lib/map3d/geoJson', () => ({
  buildMap3dGeoJson: vi.fn(() => ({
    infraLines: { type: 'FeatureCollection', features: [] },
    infraExtrusions: { type: 'FeatureCollection', features: [] },
    infraPoints: { type: 'FeatureCollection', features: [] },
    pois: { type: 'FeatureCollection', features: [] },
    thresholds: { type: 'FeatureCollection', features: [] },
    analysisLines: { type: 'FeatureCollection', features: [] },
    analysisLabels: { type: 'FeatureCollection', features: [] },
    infraLineLabels: { type: 'FeatureCollection', features: [] },
  })),
}));

vi.mock('../lib/map3d/map3dIcons', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/map3d/map3dIcons')>();
  return {
    ...actual,
    registerMap3dSubtypeIcons: vi.fn(async () => {}),
    collectSubtypesFromGeoJson: vi.fn(() => []),
  };
});

import { createMap3dBaseStyle } from '../lib/map3d/map3dBasemap';
import MapView3D from './MapView3D';

describe('MapView3D init (lazy layer loading)', () => {
  beforeEach(() => {
    mapLoadHandlers.length = 0;
    createdMapOptions.length = 0;
    ensureMap3dModelsLayer.mockClear();
    syncMap3dBasemap.mockClear();
    applyMap3dTerrain.mockClear();
    vi.mocked(createMap3dBaseStyle).mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  async function flushMapLoad() {
    await waitFor(() => expect(mapLoadHandlers.length).toBeGreaterThan(0));
    mapLoadHandlers[mapLoadHandlers.length - 1]!();
  }

  it('creates style without basemap when showBasemap is false', async () => {
    render(<MapView3D showBasemap={false} showTerrain={false} showModels={false} height="200px" />);
    await flushMapLoad();

    expect(createMap3dBaseStyle).toHaveBeenCalledWith({ includeBasemap: false });
    const style = vi.mocked(createMap3dBaseStyle).mock.results.at(-1)?.value as {
      sources?: Record<string, unknown>;
    };
    expect(style.sources?.[MAP3D_SOURCE_IDS.basemap]).toBeUndefined();
    expect(syncMap3dBasemap).toHaveBeenCalledWith(expect.anything(), false);
  });

  it('does not attach models custom layer on load when showModels is false', async () => {
    render(<MapView3D showBasemap={true} showTerrain={false} showModels={false} height="200px" />);
    await flushMapLoad();

    expect(ensureMap3dModelsLayer).not.toHaveBeenCalled();
    expect(buildMap3dModelInstances).not.toHaveBeenCalled();
    expect(ensureMap3dLinesLayer).toHaveBeenCalled();
  });

  it('attaches models layer on load when showModels is true', async () => {
    render(<MapView3D showBasemap={true} showTerrain={false} showModels={true} height="200px" />);
    await flushMapLoad();

    expect(ensureMap3dModelsLayer).toHaveBeenCalled();
    expect(buildMap3dModelInstances).toHaveBeenCalled();
  });

  it('calls applyMap3dTerrain with showTerrain flag on load', async () => {
    render(<MapView3D showBasemap={true} showTerrain={false} showModels={false} height="200px" />);
    await flushMapLoad();

    expect(applyMap3dTerrain).toHaveBeenCalledWith(expect.anything(), false, expect.any(Number));
  });
});
