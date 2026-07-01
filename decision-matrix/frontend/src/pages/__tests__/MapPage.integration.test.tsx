import React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MapPage } from '../MapPage';
import { renderPage } from '../../test/pages/renderPage';
import { seedAppStore } from '../../test/pages/seedAppStore';
import { api } from '../../lib/api';
import { samplePois, sampleInfra } from '../../test/fixtures/map';
import { clickAnalyzeAllPois, clickAnalyzeSelectedPoi } from '../../test/pages/mapCalculationsMenu';

const mapDisplayState = vi.hoisted(() => ({ mode: '2d' as '2d' | '3d' }));

vi.mock('../../components/MapView3D', () => ({
  default: React.forwardRef(function MockMapView3D() {
    return <div data-testid="mock-map-3d" />;
  }),
}));

vi.mock('../../components/CandidatesModal', () => ({
  CandidatesModal: () => <div data-testid="mock-candidates-modal" />,
}));

vi.mock('../../hooks/useMapDisplayMode', () => ({
  useMapDisplayMode: () => ({
    is3dEnabled: true,
    displayMode: mapDisplayState.mode,
    setDisplayMode: (mode: '2d' | '3d') => {
      mapDisplayState.mode = mode;
    },
    mapIn3d: mapDisplayState.mode === '3d',
  }),
}));

vi.mock('../../lib/mapViewState', () => ({
  loadMapViewState: vi.fn(() => null),
  saveMapViewState: vi.fn(),
  resolveInitialMapView3d: vi.fn(() => ({ centerLon: 37.6, centerLat: 55.75, zoom: 10, pitch: 60, bearing: 0 })),
  resolveInitialMapView: vi.fn(() => ({ centerLon: 37.6, centerLat: 55.75, zoom: 10 })),
}));

vi.mock('../../lib/mapHotkeys', () => ({
  useMapHotkeys: vi.fn(),
}));

vi.mock('../../components/DevPortBanner', () => ({
  DevPortBanner: () => null,
}));

const analyzeAllPoisAndWaitMock = vi.hoisted(() => vi.fn());

vi.mock('../../lib/runApiJob', () => ({
  analyzeAllPoisAndWait: analyzeAllPoisAndWaitMock,
  unwrapApiJobResponse: vi.fn(async (_projectId: string, response: unknown) => response),
  analyzeSandLogisticsAndWait: vi.fn(),
}));

vi.mock('../../lib/api', async (importOriginal) => {
  const { createApiMock } = await import('../../test/pages/apiMockModule');
  return createApiMock(importOriginal);
});

vi.mock('../../hooks/usePermissions', () => ({
  usePermissions: () => ({
    canWriteProject: true,
    canWriteInfra: true,
    canDeleteProject: true,
    isAdmin: false,
    can: () => true,
  }),
}));

describe('MapPage integration', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    mapDisplayState.mode = '2d';
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

  it('renders map page with 2D map', async () => {
    await renderMap();
    expect(screen.getByText('Карта инфраструктуры')).toBeInTheDocument();
    expect(screen.queryByTestId('mock-map-3d')).not.toBeInTheDocument();
    expect(document.querySelector('.map-canvas-wrap')).toBeVisible();
  });

  it('renders map shell when no project in store', async () => {
    seedAppStore({ currentProjectId: null });
    renderPage(<MapPage />);
    expect(screen.getByText('Карта инфраструктуры')).toBeInTheDocument();
  });

  async function enableEdit() {
    await userEvent.click(await screen.findByRole('button', { name: /включить редактирование/i }));
  }

  it('toolbar interactions', async () => {
    await renderMap();
    await userEvent.click(screen.getByRole('button', { name: 'Слои и настройки карты' }));
    await userEvent.click(screen.getByRole('button', { name: 'Закрыть панель слоёв' }));
    await enableEdit();
    await userEvent.click(screen.getByRole('button', { name: 'Точка интереса (POI)' }));
    await clickAnalyzeAllPois();
    await waitFor(() => expect(analyzeAllPoisAndWaitMock).toHaveBeenCalledWith('p1'));
    await userEvent.click(screen.getByLabelText('Карта 3D'));
    await waitFor(() => expect(screen.getByTestId('mock-map-3d')).toBeInTheDocument());
    await userEvent.click(screen.getByLabelText('Карта 2D'));
  });

  it('analyze selected poi from calculations menu', async () => {
    await renderMap();
    await waitFor(() => expect(api.getPois).toHaveBeenCalled());
    await enableEdit();
    await clickAnalyzeSelectedPoi();
    await waitFor(() => expect(api.analyzePoi).toHaveBeenCalled());
  });

  it('fetches poi analysis when poi selected', async () => {
    vi.mocked(api.getPoiAnalysis).mockResolvedValue({
      poi_id: 'poi-1',
      rows: [],
      computed_at: '2024-01-01',
    } as never);
    await renderMap();
    await waitFor(() => expect(api.getPois).toHaveBeenCalled());
    await waitFor(() =>
      expect(api.getPoiAnalysis).toHaveBeenCalledWith('p1', 'poi-1'),
    );

    vi.mocked(api.getPoiAnalysis).mockClear();
    vi.mocked(api.getPoiAnalysis).mockResolvedValue({
      poi_id: 'poi-2',
      rows: [],
      computed_at: '2024-01-01',
    } as never);

    await userEvent.click(screen.getByRole('combobox', { name: 'Точка интереса' }));
    await userEvent.click(await screen.findByText('POI Beta'));

    await waitFor(() =>
      expect(api.getPoiAnalysis).toHaveBeenCalledWith('p1', 'poi-2'),
    );
  });
});
