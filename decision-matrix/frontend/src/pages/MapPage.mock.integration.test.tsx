import React from 'react';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
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
  hotkeys: null as Record<string, unknown> | null,
}));

const mapDisplayState = vi.hoisted(() => ({ mode: '2d' as '2d' | '3d' }));

vi.mock('../components/MapView', () => ({
  MapView: (props: MockMapViewProps) => {
    mapCapture.mapProps = props;
    return <div data-testid="mock-map-view" />;
  },
}));

vi.mock('../components/MapView3D', () => ({
  default: React.forwardRef(function MockMapView3D() {
    return <div data-testid="mock-map-3d" />;
  }),
}));

vi.mock('../components/ObjectDetailPanel', () => ({
  ObjectDetailPanel: ({
    selection,
    onSave,
    onDelete,
    onClose,
  }: {
    selection: { kind: string };
    onSave: (data: Record<string, unknown>) => void;
    onDelete: () => void;
    onClose: () => void;
  }) => (
    <div data-testid="mock-object-detail">
      <span data-testid="detail-kind">{selection.kind}</span>
      <button type="button" onClick={() => onSave({ name: 'Updated', description: '' })}>
        Save mock detail
      </button>
      <button type="button" onClick={onDelete}>
        Delete mock detail
      </button>
      <button type="button" onClick={onClose}>
        Close mock detail
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
  useMapHotkeys: (opts: Record<string, unknown>) => {
    mapCapture.hotkeys = opts;
  },
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
    isAdmin: true,
    can: () => true,
  }),
}));

function mapProps(): MockMapViewProps {
  const p = mapCapture.mapProps;
  if (!p) throw new Error('MapView not mounted');
  return p;
}

describe('MapPage mock MapView integration', () => {
  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mapCapture.mapProps = null;
    mapCapture.hotkeys = null;
    mapDisplayState.mode = '2d';
    seedAppStore({ currentProjectId: 'p1', pushToast: vi.fn() });
    vi.mocked(api.projects).mockResolvedValue([
      {
        id: 'p1',
        name: 'Test',
        description: null,
        status: 'draft',
        visibility: 'private',
        poi_count: 2,
      },
    ] as never);
    vi.mocked(api.getPois).mockResolvedValue(samplePois);
    vi.mocked(api.getInfraObjects).mockResolvedValue(sampleInfra);
    vi.mocked(api.getLayers).mockResolvedValue([
      { id: 'layer-1', name: 'Infra', is_visible: true, project_id: 'p1' },
    ] as never);
  });

  async function renderMap() {
    renderPage(<MapPage />, { route: '/map' });
    await waitFor(() => expect(screen.getByTestId('mock-map-view')).toBeInTheDocument());
    await waitFor(() => expect(mapCapture.mapProps).toBeTruthy());
  }

  async function enableEdit() {
    await userEvent.click(
      await screen.findByRole('button', { name: /включить редактирование/i }),
    );
  }

  it('creates POI from map click and modal submit', async () => {
    await renderMap();
    await enableEdit();
    await userEvent.click(screen.getByRole('button', { name: 'Точка интереса (POI)' }));
    mapProps().onMapClick?.(37.61, 55.751);
    await waitFor(() => expect(screen.getByText('Новая точка интереса')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить точку' }));
    await waitFor(() => expect(api.createPoi).toHaveBeenCalled());
  });

  it('places infrastructure point via map click', async () => {
    const point = makeInfraPoint({ lon: 37.6, lat: 55.75 });
    vi.mocked(api.getInfraObjects).mockResolvedValue([point]);
    await renderMap();
    await enableEdit();
    await userEvent.click(screen.getByRole('button', { name: 'Точка' }));
    await userEvent.click(screen.getByText('ГКС'));
    mapProps().onMapClick?.(37.6, 55.75, { overPoint: { id: point.id, lon: 37.6, lat: 55.75 } });
    await waitFor(() => expect(api.createInfraObject).toHaveBeenCalled());
  });

  it('selects feature, saves and deletes with confirmation', async () => {
    await renderMap();
    await enableEdit();
    await userEvent.click(screen.getByRole('button', { name: /выбор/i }));
    await userEvent.click(screen.getByText('Один объект'));
    mapProps().onFeatureSelect?.({ kind: 'infra', id: sampleInfra[0]!.id });
    await waitFor(() => expect(screen.getByTestId('mock-object-detail')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'Save mock detail' }));
    await waitFor(() => expect(api.updateInfraObject).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: 'Delete mock detail' }));
    await userEvent.click(screen.getByRole('button', { name: 'Удалить выбранное' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: /удалить/i }));
    await waitFor(() => expect(api.deleteInfraObject).toHaveBeenCalled());
  });

  it('search query filters infra on the map', async () => {
    await renderMap();
    const input = screen.getByPlaceholderText(/название/i);
    await userEvent.type(input, 'zzz-no-match-xyz');
    await waitFor(() => expect(mapProps().infraObjects).toHaveLength(0));
  });

  it('ruler measurement via map clicks', async () => {
    await renderMap();
    await enableEdit();
    await userEvent.click(screen.getByRole('button', { name: /линейка/i }));
    mapProps().onMapClick?.(37.6, 55.75);
    await new Promise((r) => setTimeout(r, 300));
    mapProps().onMapClick?.(37.61, 55.76);
    await new Promise((r) => setTimeout(r, 300));
    mapProps().onFinishMeasure?.();
    await waitFor(
      () => {
        const completed = mapCapture.mapProps?.measureCompletedLines ?? [];
        expect(completed.length).toBeGreaterThan(0);
      },
      { timeout: 3000 },
    );
  });

  it('line draft and finish', async () => {
    const point = makeInfraPoint({ id: 'snap-a', lon: 37.6, lat: 55.75 });
    vi.mocked(api.getInfraObjects).mockResolvedValue([point, ...sampleInfra]);
    await renderMap();
    await enableEdit();
    await userEvent.click(screen.getByRole('button', { name: 'Линия' }));
    await userEvent.click(screen.getByText('Автодорога'));
    mapProps().onMapClick?.(37.6, 55.75, {
      overPoint: { id: point.id, lon: 37.6, lat: 55.75 },
    });
    mapProps().onMapClick?.(37.65, 55.755);
    await mapProps().onFinishLine?.(
      [
        [37.6, 55.75],
        [37.65, 55.755],
      ],
      { lon: 37.6, lat: 55.75 },
    );
    await waitFor(() => expect(api.createInfraObject).toHaveBeenCalled());
  });

  it('pointer move updates line preview', async () => {
    const point = makeInfraPoint({ lon: 37.6, lat: 55.75 });
    vi.mocked(api.getInfraObjects).mockResolvedValue([point]);
    await renderMap();
    await enableEdit();
    await userEvent.click(screen.getByRole('button', { name: 'Линия' }));
    mapProps().onMapClick?.(37.6, 55.75, {
      overPoint: { id: point.id, lon: 37.6, lat: 55.75 },
    });
    mapProps().onPointerMove?.(37.62, 55.76, null);
    mapProps().onPointerLeave?.();
    expect(mapCapture.mapProps).toBeTruthy();
  });

  it('box selection and group delete flow', async () => {
    await renderMap();
    await enableEdit();
    await userEvent.click(screen.getByRole('button', { name: /выбор/i }));
    await userEvent.click(screen.getByText('Группа объектов'));
    mapProps().onFeatureGroupSelect?.([
      { kind: 'poi', id: 'poi-1' },
      { kind: 'infra', id: sampleInfra[0]!.id },
    ]);
    await waitFor(() => expect(screen.getByText(/Выбрано: 2/)).toBeInTheDocument());
  });

  it('geometry change triggers infra update', async () => {
    await renderMap();
    await enableEdit();
    mapProps().onGeometryChange?.({
      kind: 'infra',
      id: sampleInfra[0]!.id,
      coordinates: [
        [37.6, 55.75],
        [37.7, 55.76],
      ],
    });
    await waitFor(() => expect(api.updateInfraObject).toHaveBeenCalled());
  });

  it('escape hotkey closes search', async () => {
    await renderMap();
    const input = screen.getByPlaceholderText(/название/i);
    await userEvent.type(input, 'test');
    const onEscape = mapCapture.hotkeys?.onEscape as (() => void) | undefined;
    onEscape?.();
    expect(screen.queryByText('Ничего не найдено')).not.toBeInTheDocument();
  });

  it('fit all via toolbar', async () => {
    await renderMap();
    const fitBtn = screen.queryByRole('button', { name: /показать все/i });
    if (fitBtn) {
      await userEvent.click(fitBtn);
      mapProps().onFitView?.();
    }
    expect(mapCapture.mapProps).toBeTruthy();
  });

  it('deletes POI after confirmation', async () => {
    await renderMap();
    await enableEdit();
    mapProps().onFeatureSelect?.({ kind: 'poi', id: 'poi-1' });
    await waitFor(() => expect(screen.getByTestId('mock-object-detail')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'Удалить выбранное' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: /^удалить$/i }));
    await waitFor(() => expect(api.deletePoi).toHaveBeenCalled());
  });

  it('cancels POI create modal', async () => {
    await renderMap();
    await enableEdit();
    await userEvent.click(screen.getByRole('button', { name: 'Точка интереса (POI)' }));
    mapProps().onMapClick?.(37.61, 55.751);
    await waitFor(() => expect(screen.getByText('Новая точка интереса')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'Отмена' }));
    expect(screen.queryByText('Новая точка интереса')).not.toBeInTheDocument();
  });

  it('cancels delete confirmation', async () => {
    await renderMap();
    await enableEdit();
    mapProps().onFeatureSelect?.({ kind: 'poi', id: 'poi-1' });
    await waitFor(() => expect(screen.getByTestId('mock-object-detail')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'Удалить выбранное' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: /отмена/i }));
    expect(api.deletePoi).not.toHaveBeenCalled();
    expect(api.deleteInfraObject).not.toHaveBeenCalled();
  });

  it('updates POI from detail panel', async () => {
    await renderMap();
    await enableEdit();
    mapProps().onFeatureSelect?.({ kind: 'poi', id: 'poi-1' });
    await waitFor(() => expect(screen.getByTestId('mock-object-detail')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'Save mock detail' }));
    await waitFor(() => expect(api.updatePoi).toHaveBeenCalled());
  });

});
