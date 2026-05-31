/**
 * Regression: AppLayout calls useActiveProject on every authenticated page.
 * React Query `data: projects = []` does NOT replace `null` — reading `.length` on null crashed the app.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import { ProjectsPage } from '../pages/ProjectsPage';
import { useAuthStore, useAppStore } from '../store';
import { queryKeys } from '../lib/queryKeys';
import { sampleProjects } from './fixtures/projects';

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>();
  return {
    ...actual,
    api: {
      ...actual.api,
      projects: vi.fn(),
      deleteProject: vi.fn(),
    },
  };
});

import { api } from '../lib/api';

function renderProjectsRoute(qc: QueryClient, path = '/projects') {
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/projects" element={<ProjectsPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('projects list regression (AppLayout + null cache)', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: { id: 'u1', email: 'a@b.c', username: 'Tester', role: 'admin' },
      isLoading: false,
    });
    useAppStore.setState({ currentProjectId: 'stale' });
    vi.mocked(api.projects).mockResolvedValue(sampleProjects);
    vi.mocked(api.deleteProject).mockResolvedValue(undefined);
  });

  it('Projects page loads when GET /projects returns null', async () => {
    vi.mocked(api.projects).mockResolvedValue(null as never);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    renderProjectsRoute(qc);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Проекты' })).toBeInTheDocument();
    });
    expect(screen.queryByText(/Произошла ошибка/i)).not.toBeInTheDocument();
  });

  it('Projects page loads when query cache is primed with null', async () => {
    vi.mocked(api.projects).mockResolvedValue(null as never);
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    qc.setQueryData(queryKeys.projects, null as never);

    renderProjectsRoute(qc);

    await waitFor(() => {
      expect(screen.getAllByRole('heading', { name: 'Проекты' }).length).toBeGreaterThan(0);
    });
    expect(screen.queryByText(/Произошла ошибка/i)).not.toBeInTheDocument();
  });

});
