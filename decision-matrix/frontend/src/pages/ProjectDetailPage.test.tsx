import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Routes, Route } from 'react-router-dom';
import { ProjectDetailPage } from './ProjectDetailPage';
import { renderPage } from '../test/pages/renderPage';
import { seedAppStore } from '../test/pages/seedAppStore';
import { makeProject } from '../test/fixtures/projects';
import { samplePois } from '../test/fixtures/map';
import { api } from '../lib/api';

const analyzeAllPoisAndWaitMock = vi.hoisted(() => vi.fn());

vi.mock('../lib/runApiJob', () => ({
  analyzeAllPoisAndWait: analyzeAllPoisAndWaitMock,
  unwrapApiJobResponse: vi.fn(async (_projectId: string, response: unknown) => response),
  analyzeSandLogisticsAndWait: vi.fn(),
}));

vi.mock('../lib/api', async (importOriginal) => {
  const { createApiMock } = await import('../test/pages/apiMockModule');
  return createApiMock(importOriginal);
});
vi.mock('../hooks/usePermissions', () => ({
  usePermissions: () => ({
    canWriteProject: true,
    can: () => true,
  }),
}));

describe('ProjectDetailPage', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    seedAppStore();
    vi.mocked(api.getProject).mockResolvedValue(
      makeProject({ id: 'p1', name: 'Alpha', description: 'Test project' }),
    );
    vi.mocked(api.getPois).mockResolvedValue(samplePois);
    vi.mocked(api.getPoiAnalysis).mockRejectedValue(new Error('not found'));
  });

  async function renderDetail() {
    renderPage(
      <Routes>
        <Route path="/projects/:id" element={<ProjectDetailPage />} />
      </Routes>,
      { initialEntries: ['/projects/p1'] },
    );
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Alpha', level: 1 })).toBeInTheDocument(),
    );
  }

  it('renders master-detail layout and toolbar navigation', async () => {
    await renderDetail();

    expect(document.querySelector('.project-detail-grid')).toBeTruthy();
    expect(screen.getByRole('navigation', { name: /разделы проекта/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^карта$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /матрица/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ставки/i })).toBeInTheDocument();
    expect(screen.getByText('Test project')).toBeInTheDocument();
  });

  it('shows analysis empty state for selected poi', async () => {
    await renderDetail();

    await userEvent.click(screen.getByRole('tab', { name: /анализ окружения/i }));
    await waitFor(() =>
      expect(screen.getByText(/анализ окружения не выполнен/i)).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: /анализировать окружение/i })).toBeInTheDocument();
  });

  it('runs analyze all pois from toolbar', async () => {
    analyzeAllPoisAndWaitMock.mockResolvedValue({
      analyzed_count: 1,
      results: [{ poi_id: 'poi-1', rows: [], computed_at: '2024-01-01' }],
    } as never);

    await renderDetail();

    const toolbarBtn = screen.getByRole('button', { name: /анализ \(2\)/i });
    await userEvent.click(toolbarBtn);
    await waitFor(() => expect(analyzeAllPoisAndWaitMock).toHaveBeenCalledWith('p1'));
  });

  it('shows empty state with button to open map when no pois', async () => {
    vi.mocked(api.getPois).mockResolvedValue([]);

    renderPage(
      <Routes>
        <Route path="/projects/:id" element={<ProjectDetailPage />} />
      </Routes>,
      { initialEntries: ['/projects/p1'] },
    );

    await waitFor(() => expect(screen.getByText('Добавить на карте')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /добавить на карте/i })).toBeInTheDocument();
  });
});
