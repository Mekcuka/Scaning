import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useActiveProject } from './useActiveProject';
import { useAppStore } from '../store';
import { queryKeys } from '../lib/queryKeys';
import { makeProject, sampleProjects } from '../test/fixtures/projects';

vi.mock('../lib/api', () => ({
  api: {
    projects: vi.fn(),
  },
}));

import { api } from '../lib/api';

function createWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

describe('useActiveProject', () => {
  beforeEach(() => {
    localStorage.removeItem('currentProjectId');
    useAppStore.getState().setCurrentProjectId(null);
    vi.mocked(api.projects).mockResolvedValue(sampleProjects);
  });

  it('reconciles stale project id to first available project', async () => {
    useAppStore.getState().setCurrentProjectId('stale-id');
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useActiveProject(), {
      wrapper: createWrapper(qc),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.projectId).toBe('p1');
    expect(result.current.projects).toHaveLength(2);
    expect(useAppStore.getState().currentProjectId).toBe('p1');

    useAppStore.getState().setCurrentProjectId('p2');
    await waitFor(() => {
      expect(result.current.projectId).toBe('p2');
      expect(useAppStore.getState().currentProjectId).toBe('p2');
    });
  });

  it('does not throw when API returns null (regression: data = [] only applies to undefined)', async () => {
    vi.mocked(api.projects).mockResolvedValue(null as never);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useActiveProject(), {
      wrapper: createWrapper(qc),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.projects).toEqual([]);
    expect(result.current.hasProjects).toBe(false);
    expect(result.current.projectId).toBeUndefined();
  });

  it('treats null in query cache as empty list (no .length throw)', async () => {
    vi.mocked(api.projects).mockResolvedValue(null as never);
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    qc.setQueryData(queryKeys.projects, null as never);

    const { result } = renderHook(() => useActiveProject(), {
      wrapper: createWrapper(qc),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(() => result.current.projects.length).not.toThrow();
    expect(result.current.projects).toEqual([]);
    expect(result.current.hasProjects).toBe(false);
  });

  it('clears currentProjectId when project list is empty', async () => {
    useAppStore.getState().setCurrentProjectId('gone-id');
    vi.mocked(api.projects).mockResolvedValue([]);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    renderHook(() => useActiveProject(), { wrapper: createWrapper(qc) });

    await waitFor(() => expect(useAppStore.getState().currentProjectId).toBeNull());
  });
});
