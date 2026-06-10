import { describe, expect, it, vi, beforeEach } from 'vitest';
import { StrictMode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AppLayout } from './AppLayout';
import { DashboardPage } from '../../pages/DashboardPage';
import { useAuthStore, useAppStore } from '../../store';
import type { Project } from '../../lib/api';

vi.mock('../../lib/api', async (importOriginal) => {
  const { createApiMock } = await import('../../test/pages/apiMockModule');
  return createApiMock(importOriginal);
});

import { api } from '../../lib/api';

const projects: Project[] = [
  {
    id: 'p1',
    name: 'Test',
    description: null,
    status: 'draft',
    visibility: 'private',
    poi_count: 1,
    owner_user_id: 'u1',
    owner_name: 'Tester',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
];

describe('AppLayout smoke', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: { id: 'u1', email: 'a@b.c', username: 'Tester', role: 'admin' },
      isLoading: false,
    });
    useAppStore.setState({ currentProjectId: 'stale' });
    vi.mocked(api.projects).mockResolvedValue(projects);
  });

  it('renders dashboard when projects API returns null without crashing', async () => {
    vi.mocked(api.projects).mockResolvedValue(null as unknown as Project[]);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route element={<AppLayout />}>
              <Route index element={<DashboardPage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Добро пожаловать/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/Произошла ошибка/i)).not.toBeInTheDocument();
  });

  it('renders dashboard with null project name without crashing', async () => {
    vi.mocked(api.projects).mockResolvedValue([
      { ...projects[0], name: null as unknown as string },
    ]);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route element={<AppLayout />}>
              <Route index element={<DashboardPage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Мои проекты/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/Произошла ошибка/i)).not.toBeInTheDocument();
  });

  it('renders dashboard route without error boundary crash', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <StrictMode>
        <QueryClientProvider client={qc}>
          <MemoryRouter initialEntries={['/']}>
            <Routes>
              <Route element={<AppLayout />}>
                <Route index element={<DashboardPage />} />
              </Route>
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </StrictMode>,
    );

    await waitFor(() => {
      expect(screen.getAllByText(/Добро пожаловать/i).length).toBeGreaterThan(0);
    });
    expect(screen.queryByText(/Произошла ошибка/i)).not.toBeInTheDocument();
  });
});
