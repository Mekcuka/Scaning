import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { AdminLayout } from '../components/layout/AdminLayout';
import { AdminJobsPage } from './AdminJobsPage';
import { renderPage } from '../test/pages/renderPage';
import { seedAppStore, seedAuthUser } from '../test/pages/seedAppStore';
import { api } from '../lib/api';

vi.mock('../lib/api', async (importOriginal) => {
  const { createApiMock } = await import('../test/pages/apiMockModule');
  return createApiMock(importOriginal);
});

describe('AdminJobsPage', () => {
  beforeEach(() => {
    seedAppStore();
    seedAuthUser({ role: 'admin' });
    vi.mocked(api.adminJobsHealth).mockResolvedValue({
      redis_ok: true,
      queue_name: 'decision-matrix',
      jobs_use_queue: true,
      jobs_by_status: { pending: 1, running: 0, completed: 2 },
      active_jobs: [],
    });
    vi.mocked(api.adminListJobs).mockResolvedValue({
      items: [
        {
          id: 'j1',
          project_id: 'p1',
          job_type: 'poi_analyze_all',
          status: 'pending',
          user_email: 'a@test.ru',
          user_username: 'Admin',
          project_name: 'Proj',
          created_at: '2024-01-01T12:00:00Z',
        },
      ],
      total: 1,
      limit: 50,
      offset: 0,
    });
  });

  it('shows cancel only for pending or running jobs', async () => {
    vi.mocked(api.adminListJobs).mockResolvedValue({
      items: [
        {
          id: 'j-active',
          project_id: 'p1',
          job_type: 'autoroad_connect',
          status: 'pending',
          user_email: 'a@test.ru',
          user_username: 'Admin',
          project_name: 'Proj',
          created_at: '2024-01-01T12:00:00Z',
        },
        {
          id: 'j-done',
          project_id: 'p1',
          job_type: 'autoroad_connect',
          status: 'completed',
          user_email: 'a@test.ru',
          user_username: 'Admin',
          project_name: 'Proj',
          created_at: '2024-01-01T11:00:00Z',
          finished_at: '2024-01-01T11:00:01Z',
        },
      ],
      total: 2,
      limit: 50,
      offset: 0,
    });
    renderPage(
      <Routes>
        <Route path="/admin" element={<AdminLayout />}>
          <Route path="jobs" element={<AdminJobsPage />} />
        </Route>
      </Routes>,
      { initialEntries: ['/admin/jobs'] },
    );
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: 'Отменить' })).toHaveLength(1),
    );
  });

  it('paginates jobs with 10 items per page', async () => {
    const user = userEvent.setup();
    const items = Array.from({ length: 10 }, (_, i) => ({
      id: `j-page1-${i}`,
      project_id: 'p1',
      job_type: 'poi_analyze_all',
      status: 'completed',
      user_email: 'a@test.ru',
      user_username: 'Admin',
      project_name: 'Proj',
      created_at: `2024-01-${String(10 - i).padStart(2, '0')}T12:00:00Z`,
    }));
    vi.mocked(api.adminListJobs).mockImplementation(async (params) => {
      const offset = params?.offset ?? 0;
      const limit = params?.limit ?? 10;
      const all = [
        ...items,
        {
          id: 'j-page2-0',
          project_id: 'p1',
          job_type: 'poi_analyze_all',
          status: 'completed',
          user_email: 'a@test.ru',
          user_username: 'Admin',
          project_name: 'Proj',
          created_at: '2024-01-01T08:00:00Z',
        },
      ];
      return {
        items: all.slice(offset, offset + limit),
        total: all.length,
        limit,
        offset,
      };
    });

    renderPage(
      <Routes>
        <Route path="/admin" element={<AdminLayout />}>
          <Route path="jobs" element={<AdminJobsPage />} />
        </Route>
      </Routes>,
      { initialEntries: ['/admin/jobs'] },
    );

    await waitFor(() => expect(screen.getByText('Показано 1–10 из 11')).toBeInTheDocument());
    expect(screen.getByText('Страница 1 из 2')).toBeInTheDocument();
    expect(screen.queryByText('j-page2-0')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Вперёд' }));

    await waitFor(() => expect(screen.getByText('Показано 11–11 из 11')).toBeInTheDocument());
    expect(vi.mocked(api.adminListJobs)).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 10, offset: 10 }),
    );
  });

  it('renders jobs journal without crashing', async () => {
    renderPage(
      <Routes>
        <Route path="/admin" element={<AdminLayout />}>
          <Route path="jobs" element={<AdminJobsPage />} />
        </Route>
      </Routes>,
      { initialEntries: ['/admin/jobs'] },
    );
    await waitFor(() =>
      expect(screen.getAllByRole('heading', { name: 'Очередь и worker' }).length).toBeGreaterThan(0),
    );
    await waitFor(() => expect(screen.getAllByText('Proj').length).toBeGreaterThan(0));
    expect(screen.getAllByText('Автообновление').length).toBeGreaterThan(0);
  });
});
