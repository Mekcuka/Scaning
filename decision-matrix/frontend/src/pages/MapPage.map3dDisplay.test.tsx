import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MapPage } from './MapPage';
import { renderPage } from '../test/pages/renderPage';
import { seedAppStore } from '../test/pages/seedAppStore';
import { api } from '../lib/api';
import { samplePois, sampleInfra } from '../test/fixtures/map';
import {
  defaultMapLayerPreferences,
  saveMapLayerPreferences,
} from '../lib/mapLayerPreferences';

const map3dPropsRef = vi.hoisted(() => ({
  current: null as Record<string, unknown> | null,
  mountCount: 0,
}));

vi.mock('../components/MapView3D', () => ({
  default: React.forwardRef(function MockMapView3D(
    props: Record<string, unknown>,
    _ref: React.Ref<unknown>,
  ) {
    map3dPropsRef.current = props;
    map3dPropsRef.mountCount += 1;
    return <div data-testid="mock-map-3d" />;
  }),
}));

vi.mock('../components/CandidatesModal', () => ({
  CandidatesModal: () => null,
}));

vi.mock('../hooks/useMapDisplayMode', () => ({
  useMapDisplayMode: () => {
    const [displayMode, setDisplayMode] = React.useState<'2d' | '3d'>('2d');
    return {
      is3dEnabled: true,
      displayMode,
      setDisplayMode,
      mapIn3d: displayMode === '3d',
    };
  },
}));

vi.mock('../lib/mapViewState', () => ({
  loadMapViewState: vi.fn(() => null),
  saveMapViewState: vi.fn(),
  saveMapViewState3d: vi.fn(),
  resolveInitialMapView3d: vi.fn(() => ({
    centerLon: 37.6,
    centerLat: 55.75,
    zoom: 10,
    pitch: 60,
    bearing: 0,
  })),
  resolveInitialMapView: vi.fn(() => ({ centerLon: 37.6, centerLat: 55.75, zoom: 10 })),
}));

vi.mock('../lib/mapHotkeys', () => ({
  useMapHotkeys: vi.fn(),
}));

vi.mock('../components/DevPortBanner', () => ({
  DevPortBanner: () => null,
}));

vi.mock('../lib/api', async (importOriginal) => {
  const { createApiMock } = await import('../test/pages/apiMockModule');
  return createApiMock(importOriginal);
});

vi.mock('../hooks/usePermissions', () => ({
  usePermissions: () => ({
    canWriteProject: true,
    canWriteInfra: true,
    canDeleteProject: true,
    isAdmin: false,
    can: () => true,
  }),
}));

describe('MapPage 3D display optimization', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    map3dPropsRef.current = null;
    map3dPropsRef.mountCount = 0;
    localStorage.clear();
    seedAppStore({ currentProjectId: 'p1', pushToast: vi.fn() });
    vi.mocked(api.projects).mockResolvedValue([
      { id: 'p1', name: 'Test', description: null, status: 'draft', visibility: 'private', poi_count: 2 },
    ] as never);
    vi.mocked(api.getPois).mockResolvedValue(samplePois);
    vi.mocked(api.getInfraObjects).mockResolvedValue(sampleInfra);
    vi.mocked(api.getLayers).mockResolvedValue([
      { id: 'layer-1', name: 'Infra', is_visible: true, project_id: 'p1' },
    ] as never);
  });

  async function renderMap() {
    renderPage(<MapPage />, { route: '/map' });
    await waitFor(
      () => expect(screen.getByText('Карта инфраструктуры')).toBeInTheDocument(),
      { timeout: 5000 },
    );
  }

  function map3dHost(): HTMLElement | null {
    return document.querySelector('.map-3d-host');
  }

  it('does not mount 3D map while staying in 2D', async () => {
    await renderMap();
    expect(map3dHost()).toBeNull();
    expect(screen.queryByTestId('mock-map-3d')).not.toBeInTheDocument();
  });

  it('passes showBasemap=false to MapView3D when basemap disabled in layer prefs', async () => {
    const prefs = defaultMapLayerPreferences();
    prefs.showBasemap = false;
    prefs.showTerrain = false;
    prefs.showModels = false;
    saveMapLayerPreferences('p1', prefs);

    await renderMap();
    await userEvent.click(screen.getByLabelText('Карта 3D'));

    await waitFor(() => expect(screen.getByTestId('mock-map-3d')).toBeInTheDocument());
    expect(map3dPropsRef.current?.showBasemap).toBe(false);
    expect(map3dPropsRef.current?.showTerrain).toBe(false);
    expect(map3dPropsRef.current?.showModels).toBe(false);
  });

  it('keeps 3D host mounted (hidden) after switching back to 2D', async () => {
    await renderMap();

    await userEvent.click(screen.getByLabelText('Карта 3D'));
    await waitFor(() => expect(screen.getByTestId('mock-map-3d')).toBeInTheDocument());
    const hostAfterFirst3d = map3dHost();

    await userEvent.click(screen.getByLabelText('Карта 2D'));
    await waitFor(() => expect(screen.queryByTestId('mock-map-3d')).not.toBeVisible());

    const hostWhile2d = map3dHost();
    expect(hostWhile2d).toBeTruthy();
    expect(hostWhile2d).toBe(hostAfterFirst3d);
    expect(hostWhile2d).toHaveStyle({ visibility: 'hidden' });

    await userEvent.click(screen.getByLabelText('Карта 3D'));
    await waitFor(() => expect(screen.getByTestId('mock-map-3d')).toBeVisible());
    expect(map3dHost()).toBe(hostAfterFirst3d);
  });
});
