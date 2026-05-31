import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest';
import { cleanup, screen, waitFor } from '@testing-library/react';
import { RatesPage } from './RatesPage';
import { renderWithProviders } from '../test/renderWithProviders';
import { useAppStore } from '../store';

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>();
  return {
    ...actual,
    api: {
      ...actual.api,
      getRates: vi.fn().mockResolvedValue({ project_id: 'p1', rates: { capex_road: 1 } }),
      getEconomicParams: vi.fn().mockResolvedValue({ project_id: 'p1', params: {} }),
      getDistanceDefaults: vi.fn().mockResolvedValue({
        project_id: 'p1',
        threshold_gas_processing_km: 50,
        threshold_gtes_km: 50,
        threshold_substation_km: 30,
        threshold_refinery_km: 80,
      }),
      updateRates: vi.fn().mockResolvedValue({ project_id: 'p1', rates: {} }),
      updateEconomicParams: vi.fn().mockResolvedValue({ project_id: 'p1', params: {} }),
      updateDistanceDefaults: vi.fn().mockResolvedValue({ project_id: 'p1' }),
    },
  };
});

vi.mock('../hooks/usePermissions', () => ({
  usePermissions: () => ({ canWriteProject: true }),
}));

describe('RatesPage smoke', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    useAppStore.setState({ currentProjectId: 'p1', pushToast: vi.fn() });
  });

  it('renders rates page title', async () => {
    renderWithProviders(<RatesPage />);
    await waitFor(() => {
      expect(screen.getByText('Расстояние')).toBeInTheDocument();
    });
  });
});
