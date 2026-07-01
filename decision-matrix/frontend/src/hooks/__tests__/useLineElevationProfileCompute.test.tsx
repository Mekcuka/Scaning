import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { useLineElevationProfileCompute } from '../useLineElevationProfileCompute';
import { lineElevationProfileApi } from '../../lib/api/lineElevationProfileApi';

vi.mock('../../lib/api/lineElevationProfileApi', () => ({
  lineElevationProfileApi: {
    compute: vi.fn(),
    getProfile: vi.fn(),
  },
}));

const pushToast = vi.fn();

vi.mock('../../store', () => ({
  useAppStore: (selector: (state: { pushToast: typeof pushToast }) => unknown) =>
    selector({ pushToast }),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useLineElevationProfileCompute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('computes profile and so success toast is shown', async () => {
    vi.mocked(lineElevationProfileApi.compute).mockResolvedValue({
      computed_count: 2,
      dem_fetched: true,
      dem_reused: false,
      errors: [],
    });

    const { result } = renderHook(() => useLineElevationProfileCompute('proj-1'), { wrapper });

    result.current.compute();

    await waitFor(() => expect(result.current.computePending).toBe(false));
    expect(lineElevationProfileApi.compute).toHaveBeenCalledWith('proj-1');
    expect(pushToast).toHaveBeenCalledWith('success', 'Профиль рассчитан для 2 линий.');
  });

  it('shows error toast when project is missing', async () => {
    const { result } = renderHook(() => useLineElevationProfileCompute(undefined), { wrapper });

    result.current.compute();

    await waitFor(() => expect(pushToast).toHaveBeenCalledWith('error', 'Проект не выбран'));
  });

  it('translates dem_api_not_configured in error toast', async () => {
    vi.mocked(lineElevationProfileApi.compute).mockRejectedValue(new Error('dem_api_not_configured'));

    const { result } = renderHook(() => useLineElevationProfileCompute('proj-1'), { wrapper });

    result.current.compute();

    await waitFor(() => expect(result.current.computePending).toBe(false));
    expect(pushToast).toHaveBeenCalledWith(
      'error',
      expect.stringContaining('ЦМР недоступен'),
    );
  });
});
