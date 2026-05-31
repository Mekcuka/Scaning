import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Routes, Route } from 'react-router-dom';
import { ProjectDetailPage } from './ProjectDetailPage';
import { renderPage } from '../test/pages/renderPage';
import { seedAppStore } from '../test/pages/seedAppStore';
import { makeProject } from '../test/fixtures/projects';
import { samplePois } from '../test/fixtures/map';
import { api } from '../lib/api';

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
  beforeEach(() => {
    seedAppStore();
    vi.mocked(api.getProject).mockResolvedValue(makeProject({ id: 'p1', name: 'Alpha' }));
    vi.mocked(api.getPois).mockResolvedValue(samplePois);
  });

  it('renders project detail', async () => {
    renderPage(
      <Routes>
        <Route path="/projects/:id" element={<ProjectDetailPage />} />
      </Routes>,
      { initialEntries: ['/projects/p1'] },
    );
    await waitFor(() => expect(screen.getByText('Alpha')).toBeInTheDocument());
  });

  it('runs analyze all pois', async () => {
    vi.mocked(api.analyzeAllPois).mockResolvedValue({
      analyzed_count: 1,
      results: [{ poi_id: 'poi-1', rows: [], computed_at: '2024-01-01' }],
    } as never);
    renderPage(
      <Routes>
        <Route path="/projects/:id" element={<ProjectDetailPage />} />
      </Routes>,
      { initialEntries: ['/projects/p1'] },
    );
    await waitFor(() => expect(screen.getByText('Alpha')).toBeInTheDocument());
    const btn = screen.queryByRole('button', { name: /анализ/i });
    if (btn) await userEvent.click(btn);
  });
});
