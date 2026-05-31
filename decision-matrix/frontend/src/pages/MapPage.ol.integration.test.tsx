import React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MapPage } from './MapPage';
import { renderPage } from '../test/pages/renderPage';
import { seedAppStore } from '../test/pages/seedAppStore';
import { api } from '../lib/api';
import { samplePois, sampleInfra } from '../test/fixtures/map';

const mapDisplayState = vi.hoisted(() => ({ mode: '2d' as '2d' | '3d' }));

vi.mock('../components/MapView3D', () => ({
  default: React.forwardRef(function MockMapView3D() {
    return <div data-testid="mock-map-3d" />;
  }),
}));

vi.mock('../hooks/useMapDisplayMode', () => ({
  useMapDisplayMode: () => ({
    is3dEnabled: true,
    displayMode: mapDisplayState.mode,
    setDisplayMode: (mode: '2d' | '3d') => {
      mapDisplayState.mode = mode;
    },
    mapIn3d: mapDisplayState.mode === '3d',
  }),
}));

vi.mock('../lib/mapViewState', () => ({
  loadMapViewState: vi.fn(() => null),
  saveMapViewState: vi.fn(),
  resolveInitialMapView3d: vi.fn(() => ({ centerLon: 37.6, centerLat: 55.75, zoom: 10, pitch: 60, bearing: 0 })),
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

describe('MapPage OpenLayers integration', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    mapDisplayState.mode = '2d';
    seedAppStore({ currentProjectId: 'p1', pushToast: vi.fn() });
    vi.mocked(api.getPois).mockResolvedValue(samplePois);
    vi.mocked(api.getInfraObjects).mockResolvedValue(sampleInfra);
    vi.mocked(api.getLayers).mockResolvedValue([
      { id: 'layer-1', name: 'Infra', is_visible: true, project_id: 'p1' },
    ] as never);
  });

  async function renderMap() {
    renderPage(<MapPage />, { route: '/map' });
    await waitFor(() => expect(screen.getByText('Карта инфраструктуры')).toBeInTheDocument());
    await waitFor(() => expect(document.querySelector('.ol-viewport')).toBeTruthy(), {
      timeout: 8000,
    });
  }

  it('clicks map in POI draw mode', async () => {
    await renderMap();
    await userEvent.click(await screen.findByRole('button', { name: /включить редактирование/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Точка интереса (POI)' }));
    const viewport = document.querySelector('.ol-viewport');
    expect(viewport).toBeTruthy();
    if (viewport) fireEvent.click(viewport);
  }, 15000);

  it('clicks map in line draw mode', async () => {
    await renderMap();
    await userEvent.click(await screen.findByRole('button', { name: /включить редактирование/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Линия' }));
    await userEvent.click(screen.getByText('Автодорога'));
    const viewport = document.querySelector('.ol-viewport');
    if (viewport) {
      fireEvent.click(viewport);
      fireEvent.click(viewport);
      fireEvent.dblClick(viewport);
    }
  }, 15000);
});
