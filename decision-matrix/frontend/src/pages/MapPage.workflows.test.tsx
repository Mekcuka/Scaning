import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MapPage } from './MapPage';
import { renderPage } from '../test/pages/renderPage';
import { seedAppStore } from '../test/pages/seedAppStore';
import { api } from '../lib/api';
import { sampleInfra, samplePois } from '../test/fixtures/map';
import { makeInfraPoint } from '../test/fixtures/infra';
import type { MockMapViewProps } from '../test/mocks/MockMapView';

const mapCapture = vi.hoisted(() => ({
  mapProps: null as MockMapViewProps | null,
}));

vi.mock('../components/MapView', () => ({
  MapView: (props: MockMapViewProps) => {
    mapCapture.mapProps = props;
    return <div data-testid="mock-map-view" />;
  },
}));

vi.mock('../components/MapView3D', () => ({
  default: () => <div data-testid="mock-map-3d" />,
}));

vi.mock('../components/ObjectDetailPanel', () => ({
  ObjectDetailPanel: ({
    onSave,
    onDelete,
  }: {
    onSave: (data: Record<string, unknown>) => void;
    onDelete: () => void;
  }) => (
    <div data-testid="mock-object-detail">
      <button type="button" onClick={() => onSave({ name: 'Updated' })}>
        Save mock detail
      </button>
      <button type="button" onClick={onDelete}>
        Delete mock detail
      </button>
    </div>
  ),
}));

vi.mock('../components/CandidatesModal', () => ({
  CandidatesModal: () => <div data-testid="mock-candidates-modal" />,
}));

vi.mock('../hooks/useMapDisplayMode', () => ({
  useMapDisplayMode: () => ({
    is3dEnabled: true,
    displayMode: '2d' as const,
    setDisplayMode: vi.fn(),
    mapIn3d: false,
  }),
}));

vi.mock('../lib/mapViewState', () => ({
  loadMapViewState: vi.fn(() => null),
  saveMapViewState: vi.fn(),
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

const analyzeAllPoisAndWaitMock = vi.hoisted(() => vi.fn());

vi.mock('../lib/runApiJob', () => ({
  analyzeAllPoisAndWait: analyzeAllPoisAndWaitMock,
  unwrapApiJobResponse: vi.fn(async (_projectId: string, response: unknown) => response),
  analyzeSandLogisticsAndWait: vi.fn(),
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
    isAdmin: true,
    can: () => true,
  }),
}));

function props() {
  const p = mapCapture.mapProps;
  if (!p) throw new Error('MapView not mounted');
  return p;
}

describe('MapPage workflow coverage', () => {
  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mapCapture.mapProps = null;
    seedAppStore({ currentProjectId: 'p1', pushToast: vi.fn() });
    vi.mocked(api.getPois).mockResolvedValue(samplePois);
    vi.mocked(api.getInfraObjects).mockResolvedValue(sampleInfra);
    vi.mocked(api.getLayers).mockResolvedValue([
      { id: 'layer-1', name: 'Infra', is_visible: true, project_id: 'p1' },
    ] as never);
    vi.mocked(api.getPoiAnalysis).mockResolvedValue({
      poi_id: 'poi-1',
      rows: [{ subtype: 'gas_processing', status: 'within_limit' }],
      computed_at: '2024-01-01',
    } as never);
  });

  it('walks edit, draw, measure, search, layers and analysis tools', async () => {
    renderPage(<MapPage />, { route: '/map' });
    await waitFor(() => expect(screen.getByTestId('mock-map-view')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: /включить редактирование/i }));

    await userEvent.click(screen.getByRole('button', { name: 'Слои и настройки карты' }));
    const layerChecks = screen.getAllByRole('checkbox');
    for (const box of layerChecks.slice(0, 3)) {
      await userEvent.click(box);
    }
    await userEvent.click(screen.getByRole('button', { name: 'Закрыть панель слоёв' }));

    await userEvent.click(screen.getByRole('button', { name: /Все точки/i }));
    await waitFor(() => expect(analyzeAllPoisAndWaitMock).toHaveBeenCalledWith('p1'));

    await userEvent.click(screen.getByRole('button', { name: /линейка/i }));
    props().onMapClick?.(37.6, 55.75);
    await new Promise((r) => setTimeout(r, 300));
    props().onMapClick?.(37.61, 55.76);
    await new Promise((r) => setTimeout(r, 300));
    props().onFinishMeasure?.();

    await userEvent.click(screen.getByRole('button', { name: 'Точка' }));
    await userEvent.click(screen.getByText('ГКС'));
    const point = makeInfraPoint({ lon: 37.6, lat: 55.75 });
    props().onMapClick?.(37.6, 55.75, {
      overPoint: { id: point.id, lon: 37.6, lat: 55.75 },
    });

    await userEvent.click(screen.getByRole('button', { name: /один объект/i }));
    props().onFeatureSelect?.({ kind: 'infra', id: sampleInfra[0]!.id });
    await waitFor(() => expect(screen.getByTestId('mock-object-detail')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'Save mock detail' }));

    await userEvent.type(screen.getByPlaceholderText(/название/i), 'zzz');
    expect(props().infraObjects).toHaveLength(0);

    await userEvent.click(screen.getByRole('button', { name: 'Линия' }));
    await userEvent.click(screen.getByText('Автодорога'));
    const snap = makeInfraPoint({ id: 'snap-w', lon: 37.6, lat: 55.75 });
    vi.mocked(api.getInfraObjects).mockResolvedValue([snap, ...sampleInfra]);
    props().onMapClick?.(37.6, 55.75, {
      overPoint: { id: snap.id, lon: 37.6, lat: 55.75 },
    });
    props().onMapClick?.(37.65, 55.755);
    await props().onFinishLine?.(
      [
        [37.6, 55.75],
        [37.65, 55.755],
      ],
      { lon: 37.6, lat: 55.75 },
    );

    await userEvent.click(screen.getByRole('button', { name: /группа объектов/i }));
    props().onFeatureGroupSelect?.([
      { kind: 'poi', id: 'poi-1' },
      { kind: 'infra', id: sampleInfra[0]!.id },
    ]);
    await waitFor(() => expect(screen.getByText(/Выбрано: 2/)).toBeInTheDocument());

    props().onPointerMove?.(37.62, 55.77, undefined);
    props().onPointerLeave?.();
    props().onFitView?.();
    props().onGeometryChange?.(
      { kind: 'infra', id: sampleInfra[0]!.id },
      37.6,
      55.75,
      [
        [37.6, 55.75],
        [37.7, 55.76],
      ],
    );

  });
});
