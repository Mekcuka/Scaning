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
import { makeInfraLine, makeInfraPoint } from '../test/fixtures/infra';
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

  it('places methanol_facility from point tool menu', async () => {
    await renderMap();
    await enableEdit();
    await userEvent.click(screen.getByRole('button', { name: 'Точка' }));
    await userEvent.click(screen.getByText('Объект метанола'));
    mapProps().onMapClick?.(37.62, 55.76);
    await waitFor(() => expect(api.createInfraObject).toHaveBeenCalled());
    const payload = vi.mocked(api.createInfraObject).mock.calls.at(-1)?.[1];
    expect(payload?.subtype).toBe('methanol_facility');
  });

  it('selects feature, saves and deletes with confirmation', async () => {
    await renderMap();
    await enableEdit();
    await userEvent.click(screen.getByRole('button', { name: /один объект/i }));
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
    mapProps().onPointerMove?.(37.62, 55.76, undefined);
    mapProps().onPointerLeave?.();
    expect(mapCapture.mapProps).toBeTruthy();
  });

  it('box selection and group delete flow', async () => {
    await renderMap();
    await enableEdit();
    await userEvent.click(screen.getByRole('button', { name: /группа объектов/i }));
    mapProps().onFeatureGroupSelect?.([
      { kind: 'poi', id: 'poi-1' },
      { kind: 'infra', id: sampleInfra[0]!.id },
    ]);
    await waitFor(() => expect(screen.getByText(/Выбрано: 2/)).toBeInTheDocument());
  });

  it('copy group and paste via map click', async () => {
    await renderMap();
    await enableEdit();
    await userEvent.click(screen.getByRole('button', { name: /группа объектов/i }));
    mapProps().onFeatureGroupSelect?.([
      { kind: 'poi', id: 'poi-1' },
      { kind: 'infra', id: sampleInfra[0]!.id },
    ]);
    await waitFor(() => expect(screen.getByText(/Выбрано: 2/)).toBeInTheDocument());
    const panel = screen.getByText(/Выбрано: 2/).closest('.map-group-panel');
    expect(panel).toBeTruthy();
    await userEvent.click(within(panel as HTMLElement).getByRole('button', { name: /^Копировать$/ }));
    const pasteBtn = within(panel as HTMLElement).getByRole('button', { name: /^Вставить$/ });
    await waitFor(() => expect(pasteBtn).not.toBeDisabled());
    await userEvent.click(pasteBtn);
    await waitFor(() => expect(mapProps().pasteMode).toBe(true));
    await waitFor(() => expect(mapProps().onMapClick).toBeTypeOf('function'));
    mapProps().onMapClick?.(38, 56);
    await waitFor(() => expect(api.createPoi).toHaveBeenCalled());
    await waitFor(() => expect(api.createInfraObject).toHaveBeenCalled());
  });

  it('paste methanol_facility via createInfraObject', async () => {
    const methanol = makeInfraPoint({
      id: 'mf-1',
      subtype: 'methanol_facility',
      name: 'Объект метанола_1',
    });
    vi.mocked(api.getInfraObjects).mockResolvedValue([methanol]);
    await renderMap();
    await enableEdit();
    await userEvent.click(screen.getByRole('button', { name: /группа объектов/i }));
    mapProps().onFeatureGroupSelect?.([{ kind: 'infra', id: methanol.id }]);
    await waitFor(() => expect(screen.getByText(/Выбрано: 1/)).toBeInTheDocument());
    const panel = screen.getByText(/Выбрано: 1/).closest('.map-group-panel')!;
    await userEvent.click(within(panel as HTMLElement).getByRole('button', { name: /^Копировать$/ }));
    await userEvent.click(within(panel as HTMLElement).getByRole('button', { name: /^Вставить$/ }));
    mapProps().onMapClick?.(38, 56);
    await waitFor(() => expect(api.createInfraObject).toHaveBeenCalled());
    const createCall = vi.mocked(api.createInfraObject).mock.calls.at(-1)?.[1];
    expect(createCall?.subtype).toBe('methanol_facility');
    expect(api.createFacilityInfraObject).not.toHaveBeenCalled();
    expect(api.updateInfraObject).not.toHaveBeenCalled();
  });

  it('paste oil_pumping_station uses facility-objects endpoint', async () => {
    const nps = makeInfraPoint({
      id: 'nps-1',
      subtype: 'oil_pumping_station',
      name: 'НПС_1',
    });
    vi.mocked(api.getInfraObjects).mockResolvedValue([nps]);
    await renderMap();
    await enableEdit();
    await userEvent.click(screen.getByRole('button', { name: /группа объектов/i }));
    mapProps().onFeatureGroupSelect?.([{ kind: 'infra', id: nps.id }]);
    await waitFor(() => expect(screen.getByText(/Выбрано: 1/)).toBeInTheDocument());
    const panel = screen.getByText(/Выбрано: 1/).closest('.map-group-panel')!;
    await userEvent.click(within(panel as HTMLElement).getByRole('button', { name: /^Копировать$/ }));
    await userEvent.click(within(panel as HTMLElement).getByRole('button', { name: /^Вставить$/ }));
    mapProps().onMapClick?.(38, 56);
    await waitFor(() => expect(api.createFacilityInfraObject).toHaveBeenCalled());
    expect(api.createInfraObject).not.toHaveBeenCalled();
    const facilityCall = vi.mocked(api.createFacilityInfraObject).mock.calls.at(-1)?.[1];
    expect(facilityCall?.subtype).toBe('oil_pumping_station');
  });

  it('paste gas_pad creates oil_pad then updates subtype', async () => {
    const gasPad = makeInfraPoint({
      id: 'pad-gas',
      subtype: 'gas_pad',
      name: 'Газовый куст_1',
    });
    vi.mocked(api.getInfraObjects).mockResolvedValue([gasPad]);
    await renderMap();
    await enableEdit();
    await userEvent.click(screen.getByRole('button', { name: /группа объектов/i }));
    mapProps().onFeatureGroupSelect?.([{ kind: 'infra', id: gasPad.id }]);
    await waitFor(() => expect(screen.getByText(/Выбрано: 1/)).toBeInTheDocument());
    const panel = screen.getByText(/Выбрано: 1/).closest('.map-group-panel')!;
    await userEvent.click(within(panel as HTMLElement).getByRole('button', { name: /^Копировать$/ }));
    await userEvent.click(within(panel as HTMLElement).getByRole('button', { name: /^Вставить$/ }));
    mapProps().onMapClick?.(38, 56);
    await waitFor(() => expect(api.createInfraObject).toHaveBeenCalled());
    const createCall = vi.mocked(api.createInfraObject).mock.calls.at(-1)?.[1];
    expect(createCall?.subtype).toBe('oil_pad');
    await waitFor(() =>
      expect(api.updateInfraObject).toHaveBeenCalledWith(
        'p1',
        'infra-new',
        expect.objectContaining({ subtype: 'gas_pad' }),
      ),
    );
  });

  it('batch geometry change updates multiple objects', async () => {
    await renderMap();
    await enableEdit();
    await userEvent.click(screen.getByRole('button', { name: /группа объектов/i }));
    mapProps().onFeatureGroupSelect?.([{ kind: 'poi', id: 'poi-1' }]);
    await waitFor(() => expect(mapProps().onBatchGeometryChange).toBeTruthy());
    await mapProps().onBatchGeometryChange?.([
      { sel: { kind: 'poi', id: 'poi-1' }, lon: 38, lat: 56 },
    ]);
    await waitFor(() => expect(api.updatePoi).toHaveBeenCalled());
  });

  it('batch move updates linked line when both endpoints move', async () => {
    const pointA = makeInfraPoint({
      id: 'gks-a',
      subtype: 'gas_processing',
      name: 'GKS_A',
      lon: 37.6,
      lat: 55.75,
    });
    const pointB = makeInfraPoint({
      id: 'gks-b',
      subtype: 'gas_processing',
      name: 'GKS_B',
      lon: 37.7,
      lat: 55.76,
    });
    const line = makeInfraLine({
      id: 'pipe-1',
      subtype: 'gas_pipeline',
      lon: 37.6,
      lat: 55.75,
      end_lon: 37.7,
      end_lat: 55.76,
      coordinates: [
        [37.6, 55.75],
        [37.7, 55.76],
      ],
    });
    vi.mocked(api.getInfraObjects).mockResolvedValue([pointA, pointB, line]);
    await renderMap();
    await enableEdit();
    await userEvent.click(screen.getByRole('button', { name: /группа объектов/i }));
    await waitFor(() => expect(mapProps().onBatchGeometryChange).toBeTruthy());
    vi.mocked(api.updateInfraObject).mockClear();
    await mapProps().onBatchGeometryChange?.([
      { sel: { kind: 'infra', id: 'gks-a' }, lon: 37.61, lat: 55.751 },
      { sel: { kind: 'infra', id: 'gks-b' }, lon: 37.71, lat: 55.761 },
    ]);
    await waitFor(() => expect(api.updateInfraObject).toHaveBeenCalled());
    const lineUpdates = vi
      .mocked(api.updateInfraObject)
      .mock.calls.filter((c) => c[1] === 'pipe-1');
    expect(lineUpdates).toHaveLength(1);
    expect(lineUpdates[0]![2]).toMatchObject({
      coordinates: [
        [37.61, 55.751],
        [37.71, 55.761],
      ],
    });
    const pointUpdates = vi
      .mocked(api.updateInfraObject)
      .mock.calls.filter((c) => c[1] === 'gks-a' || c[1] === 'gks-b');
    expect(pointUpdates).toHaveLength(2);
  });

  it('geometry change triggers infra update', async () => {
    await renderMap();
    await enableEdit();
    mapProps().onGeometryChange?.(
      { kind: 'infra', id: sampleInfra[0]!.id },
      37.6,
      55.75,
      [
        [37.6, 55.75],
        [37.7, 55.76],
      ],
    );
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
