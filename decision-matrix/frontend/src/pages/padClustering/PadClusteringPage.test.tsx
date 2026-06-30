import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { PadClusteringLayout } from '../../components/layout/PadClusteringLayout';
import { PadClusteringSummaryPage } from './PadClusteringSummaryPage';
import { PadClusteringWorkspacePage } from './PadClusteringWorkspacePage';
import { renderPage } from '../../test/pages/renderPage';
import { seedAppStore } from '../../test/pages/seedAppStore';
import { makeInfraPoint } from '../../test/fixtures/infra';

vi.mock('../../lib/api', async (importOriginal) => {
  const { createApiMock } = await import('../../test/pages/apiMockModule');
  return createApiMock(importOriginal);
});
vi.mock('../../hooks/usePermissions', () => ({
  usePermissions: () => ({ can: () => true, canWriteProject: true }),
}));
vi.mock('../../lib/api/padEarthworkApi', () => ({
  padEarthworkApi: {
    getLast: vi.fn().mockResolvedValue({ params: null, result: null }),
  },
}));
vi.mock('../../lib/api/wellTrajectoryApi', () => ({
  wellTrajectoryApi: {
    getLast: vi.fn().mockResolvedValue({
      trajectories: [],
      wells_local: [],
      computed_at: null,
      settings: {
        default_error_model: 'default',
        default_azi_reference: 'grid',
        sf_warning_threshold: 1,
        units: 'm',
      },
      warnings: [],
    }),
  },
}));
vi.mock('../../lib/api/pywellgeoApi', () => ({
  DEFAULT_PYWELLGEO_SETTINGS: {
    default_radius_m: 0.10795,
    tsurface_c: 10,
    tgrad_c_per_m: 0.031,
    yaml_format_default: 'XYZGENERIC',
  },
  pywellgeoApi: {
    getLast: vi.fn().mockResolvedValue({
      settings: {
        default_radius_m: 0.10795,
        tsurface_c: 10,
        tgrad_c_per_m: 0.031,
        yaml_format_default: 'XYZGENERIC',
      },
      trees: [],
      computed_at: null,
      warnings: [],
    }),
  },
}));
vi.mock('../../components/padClustering/PadClusteringScene3D', () => ({
  PadClusteringScene3D: () => <div data-testid="mock-pad-clustering-scene" />,
}));

function renderPadClustering(initialPath = '/pad-clustering/workspace/p1') {
  return renderPage(
    <Routes>
      <Route path="/pad-clustering" element={<PadClusteringLayout />}>
        <Route path="workspace/:projectId" element={<PadClusteringWorkspacePage />} />
        <Route path="summary/:projectId" element={<PadClusteringSummaryPage />} />
      </Route>
    </Routes>,
    { route: initialPath },
  );
}

describe('PadClusteringLayout', () => {
  beforeEach(() => {
    seedAppStore({ currentProjectId: 'p1' });
  });

  it('prompts to select a project when none is active', () => {
    seedAppStore({ currentProjectId: null });
    renderPadClustering('/pad-clustering/workspace/p1');
    expect(screen.getAllByText(/Выберите активный проект/i).length).toBeGreaterThan(0);
  });

  it('shows empty state when project has no pad objects', async () => {
    const { api } = await import('../../lib/api');
    vi.mocked(api.getInfraObjects).mockResolvedValue([
      makeInfraPoint({ subtype: 'node', name: 'Узел_1' }),
    ] as never);
    renderPadClustering();
    await waitFor(() =>
      expect(screen.getByText(/нет кустовых площадок/i)).toBeInTheDocument(),
    );
  });

  it('renders pad editor chrome when an oil pad exists', async () => {
    const { api } = await import('../../lib/api');
    vi.mocked(api.getInfraObjects).mockResolvedValue([
      makeInfraPoint({
        id: 'pad-1',
        subtype: 'oil_pad',
        name: 'Куст_1',
        properties: { pad_length_m: 120, pad_width_m: 80, pad_rotation_deg: 90 },
      }),
    ] as never);
    renderPadClustering();
    await waitFor(() => expect(screen.getByText('Настройки')).toBeInTheDocument());
    expect(screen.getAllByText('Куст_1').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Сохранить' })).toBeInTheDocument();
    expect(screen.getByTestId('mock-pad-clustering-scene')).toBeInTheDocument();
    expect(screen.getAllByText(/Куст/).length).toBeGreaterThan(0);
    expect(screen.getByText('Сводка расчёта')).toBeInTheDocument();
  });

  it('switches to calculation sidebar tab', async () => {
    const user = userEvent.setup();
    const { api } = await import('../../lib/api');
    vi.mocked(api.getInfraObjects).mockResolvedValue([
      makeInfraPoint({
        id: 'pad-1',
        subtype: 'oil_pad',
        name: 'Куст_1',
        properties: { pad_length_m: 120, pad_width_m: 80, pad_rotation_deg: 90 },
      }),
    ] as never);
    renderPadClustering();
    await waitFor(() => expect(screen.getByText('Настройки')).toBeInTheDocument());
    const calcTabs = screen.getAllByText('Расчёт');
    await user.click(calcTabs[calcTabs.length - 1]!);
  });

  it('shows summary tab content', async () => {
    const { api } = await import('../../lib/api');
    vi.mocked(api.getInfraObjects).mockResolvedValue([
      makeInfraPoint({
        id: 'pad-1',
        subtype: 'oil_pad',
        name: 'Куст_1',
        properties: { pad_length_m: 120, pad_width_m: 80, pad_rotation_deg: 90 },
      }),
    ] as never);
    renderPadClustering('/pad-clustering/summary/p1');
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Кусты' })).toBeInTheDocument());
    expect(screen.getByRole('heading', { name: 'Забои и доп. стволы' })).toBeInTheDocument();
  });
});
