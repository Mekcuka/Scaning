import type { ReactNode } from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import {
  hydrateSandLogisticsFromSession,
  useProjectSandLogistics,
  writeSandLogisticsCache,
} from './useProjectSandLogistics';
import { createTestQueryClient } from '../test/renderWithProviders';
import type { SandLogisticsReadApiPort } from '../lib/api';
import { complexSandLogisticsResult } from '../test/fixtures/sandLogisticsFixtures';
import { clearSandLogisticsSessionCache } from '../lib/sandLogisticsResult';

function createSandApiMock(): SandLogisticsReadApiPort {
  return { getSandLogisticsResult: vi.fn() };
}

function wrapper({ children }: { children: ReactNode }) {
  const client = createTestQueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useProjectSandLogistics', () => {
  let sandLogisticsApi: SandLogisticsReadApiPort;

  beforeEach(() => {
    sandLogisticsApi = createSandApiMock();
  });

  it('loads result from API', async () => {
    vi.mocked(sandLogisticsApi.getSandLogisticsResult).mockResolvedValue({
      project_id: 'p-sand',
      horizon_from: '2025-01-01',
      horizon_to: '2025-12-31',
      as_of: '2025-01-01',
      network_id: '',
      subnet_count: 0,
      subnets: [],
      timeline: [],
      warnings: [],
      object_names: {},
      calculated_at: '2025-06-01T12:00:00+00:00',
    });
    const { result } = renderHook(
      () => useProjectSandLogistics('p-sand', { sandLogisticsApi }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.subnets).toEqual([]);
    expect(result.current.data?.calculated_at).toBeTruthy();
  });

  it('returns null when API returns null (404)', async () => {
    vi.mocked(sandLogisticsApi.getSandLogisticsResult).mockResolvedValue(null);
    const { result } = renderHook(
      () => useProjectSandLogistics('p-empty', { sandLogisticsApi }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it('returns null when projectId is missing', async () => {
    const { result } = renderHook(
      () => useProjectSandLogistics(null, { sandLogisticsApi }),
      { wrapper },
    );
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('hydrates from session without calling API when cache is empty', async () => {
    const projectId = 'hydrate-proj';
    clearSandLogisticsSessionCache(projectId);
    const client = createTestQueryClient();
    const fixture = complexSandLogisticsResult();
    writeSandLogisticsCache(client, projectId, fixture);

    vi.mocked(sandLogisticsApi.getSandLogisticsResult).mockClear();
    client.removeQueries({ queryKey: ['sand-logistics', projectId] });
    expect(hydrateSandLogisticsFromSession(client, projectId)).toBe(true);
    expect(client.getQueryData(['sand-logistics', projectId])).toBeTruthy();
    expect(sandLogisticsApi.getSandLogisticsResult).not.toHaveBeenCalled();
    clearSandLogisticsSessionCache(projectId);
  });

  it('does not refetch on remount when data is already cached', async () => {
    vi.mocked(sandLogisticsApi.getSandLogisticsResult).mockResolvedValue({
      project_id: 'p-remount',
      horizon_from: '2025-01-01',
      horizon_to: '2025-12-31',
      as_of: '2025-01-01',
      network_id: '',
      subnet_count: 0,
      subnets: [],
      timeline: [],
      warnings: [],
      object_names: {},
      calculated_at: '2025-06-01T12:00:00+00:00',
    });
    const client = createTestQueryClient();
    const wrap = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { unmount } = renderHook(
      () => useProjectSandLogistics('p-remount', { sandLogisticsApi }),
      { wrapper: wrap },
    );
    await waitFor(() => expect(sandLogisticsApi.getSandLogisticsResult).toHaveBeenCalledTimes(1));
    unmount();
    renderHook(() => useProjectSandLogistics('p-remount', { sandLogisticsApi }), { wrapper: wrap });
    await waitFor(() => expect(sandLogisticsApi.getSandLogisticsResult).toHaveBeenCalledTimes(1));
  });
});
