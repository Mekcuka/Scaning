import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MapPage } from './MapPage';
import { renderPage } from '../test/pages/renderPage';
import { seedAppStore } from '../test/pages/seedAppStore';
import { api } from '../lib/api';
import { sampleInfra, samplePois } from '../test/fixtures/map';

const mapCapture = vi.hoisted(() => ({
  mapProps: null as Record<string, unknown> | null,
}));

vi.mock('../components/MapView', () => ({
  MapView: (props: Record<string, unknown>) => {
    mapCapture.mapProps = props;
    return <div data-testid="mock-map-view" />;
  },
}));

vi.mock('../components/MapView3D', () => ({
  default: () => <div data-testid="mock-map-3d" />,
}));

vi.mock('../components/CandidatesModal', () => ({
  CandidatesModal: () => null,
}));

vi.mock('../hooks/useMapDisplayMode', () => ({
  useMapDisplayMode: () => ({
    is3dEnabled: false,
    displayMode: '2d' as const,
    setDisplayMode: vi.fn(),
    mapIn3d: false,
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
    canWriteProject: false,
    canWriteInfra: false,
    canDeleteProject: false,
    isAdmin: false,
    can: () => false,
  }),
}));

describe('MapPage read-only', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    seedAppStore({ currentProjectId: 'p1', pushToast: vi.fn() });
    vi.mocked(api.getPois).mockResolvedValue(samplePois);
    vi.mocked(api.getInfraObjects).mockResolvedValue(sampleInfra);
    vi.mocked(api.getLayers).mockResolvedValue([
      { id: 'layer-1', name: 'Infra', is_visible: true, project_id: 'p1' },
    ] as never);
  });

  it('disables edit and draw when user cannot write', async () => {
    renderPage(<MapPage />, { route: '/map' });
    await waitFor(() => expect(screen.getByTestId('mock-map-view')).toBeInTheDocument());
    const editBtn = screen.getByRole('button', { name: /включить редактирование/i });
    expect(editBtn).toBeDisabled();
    expect(mapCapture.mapProps?.editMode).toBeFalsy();
    await userEvent.click(screen.getByRole('button', { name: 'Точка интереса (POI)' }));
    mapCapture.mapProps?.onMapClick?.(37.6, 55.75);
    expect(screen.queryByText('Новая точка интереса')).not.toBeInTheDocument();
  });
});
