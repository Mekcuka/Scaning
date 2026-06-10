import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useDeleteProjectDialog } from './useDeleteProjectDialog';
import { useAppStore } from '../store';
import { queryKeys } from '../lib/queryKeys';
import { makeProject, sampleProjects } from '../test/fixtures/projects';

const { mockDeleteProject } = vi.hoisted(() => ({
  mockDeleteProject: vi.fn(),
}));

vi.mock('../lib/api', async (importOriginal) => {
  const { createApiMock } = await import('../test/pages/apiMockModule');
  return createApiMock(importOriginal, { deleteProject: mockDeleteProject });
});

import { api } from '../lib/api';

function withProviders(qc: QueryClient, children: ReactNode) {
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/projects']}>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('useDeleteProjectDialog', () => {
  beforeEach(() => {
    useAppStore.setState({ currentProjectId: 'p1' });
    vi.mocked(api.deleteProject).mockResolvedValue(undefined);
  });

  it('mounts inside router without throwing', () => {
    const qc = new QueryClient();
    expect(() =>
      renderHook(() => useDeleteProjectDialog(), {
        wrapper: ({ children }) => withProviders(qc, children),
      }),
    ).not.toThrow();
  });

  it('updates projects cache when previous cache was null (post-delete regression)', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    qc.setQueryData(queryKeys.projects, null as never);

    const { result } = renderHook(() => useDeleteProjectDialog(), {
      wrapper: ({ children }) => withProviders(qc, children),
    });

    act(() => {
      result.current.openDeleteDialog(makeProject({ id: 'p1', name: 'Alpha' }));
    });

    await act(async () => {
      result.current.deleteMut.mutate('p1');
    });

    await waitFor(() => expect(result.current.deleteMut.isSuccess).toBe(true));

    expect(qc.getQueryData(queryKeys.projects)).toEqual([]);
    expect(useAppStore.getState().currentProjectId).toBeNull();
  });

  it('removes deleted project and switches currentProjectId to remaining', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    qc.setQueryData(queryKeys.projects, sampleProjects);

    const { result } = renderHook(() => useDeleteProjectDialog(), {
      wrapper: ({ children }) => withProviders(qc, children),
    });

    act(() => {
      result.current.openDeleteDialog(sampleProjects[0]);
    });

    await act(async () => {
      result.current.deleteMut.mutate('p1');
    });

    await waitFor(() => expect(result.current.deleteMut.isSuccess).toBe(true));

    const remaining = qc.getQueryData<typeof sampleProjects>(queryKeys.projects);
    expect(remaining).toEqual([sampleProjects[1]]);
    expect(useAppStore.getState().currentProjectId).toBe('p2');
  });
});
