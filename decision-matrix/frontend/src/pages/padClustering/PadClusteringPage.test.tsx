import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { PadClusteringPage } from './PadClusteringPage';
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
vi.mock('../../components/padClustering/PadClusteringScene3D', () => ({
  PadClusteringScene3D: () => <div data-testid="mock-pad-clustering-scene" />,
}));

describe('PadClusteringPage', () => {
  beforeEach(() => {
    seedAppStore({ currentProjectId: 'p1' });
  });

  it('prompts to select a project when none is active', () => {
    seedAppStore({ currentProjectId: null });
    renderPage(<PadClusteringPage />);
    expect(screen.getByRole('heading', { name: 'Кустование' })).toBeInTheDocument();
    expect(screen.getByText(/Выберите активный проект/i)).toBeInTheDocument();
  });

  it('shows empty state when project has no pad objects', async () => {
    const { api } = await import('../../lib/api');
    vi.mocked(api.getInfraObjects).mockResolvedValue([
      makeInfraPoint({ subtype: 'node', name: 'Узел_1' }),
    ] as never);
    renderPage(<PadClusteringPage />);
    await waitFor(() =>
      expect(screen.getByText(/нет кустовых площадок/i)).toBeInTheDocument(),
    );
    expect(screen.getByRole('heading', { name: 'Кустование' })).toBeInTheDocument();
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
    renderPage(<PadClusteringPage />);
    await waitFor(() => expect(screen.getByRole('tab', { name: /Настройки/i })).toBeInTheDocument());
    expect(screen.getAllByText('Куст_1').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Сохранить' })).toBeInTheDocument();
    expect(screen.getByTestId('mock-pad-clustering-scene')).toBeInTheDocument();
  });
});
