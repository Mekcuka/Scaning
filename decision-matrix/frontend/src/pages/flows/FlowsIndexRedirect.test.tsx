import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { FlowsIndexRedirect } from './FlowsIndexRedirect';
import { renderPage } from '../../test/pages/renderPage';
import { seedAppStore } from '../../test/pages/seedAppStore';
import { defaultProjectsDataApi } from '../../lib/api';

vi.mock('../../lib/api', async (importOriginal) => {
  const { createApiMock } = await import('../../test/pages/apiMockModule');
  return createApiMock(importOriginal);
});

function renderRedirect() {
  return renderPage(
    <Routes>
      <Route path="/flows/:projectId" element={<FlowsIndexRedirect />} />
      <Route path="/flows/logistics/:projectId" element={<div>logistics-page</div>} />
      <Route path="/flows/technology/:projectId" element={<div>technology-page</div>} />
      <Route path="/flows/economic/:projectId" element={<div>economic-page</div>} />
      <Route path="/flows/technology" element={<div>technology-bare</div>} />
    </Routes>,
    { initialEntries: ['/flows/p1'] },
  );
}

describe('FlowsIndexRedirect', () => {
  beforeEach(() => {
    sessionStorage.clear();
    seedAppStore({ currentProjectId: 'p1' });
    vi.mocked(defaultProjectsDataApi.getPois).mockReset();
  });

  it('redirects to logistics when no POIs', async () => {
    vi.mocked(defaultProjectsDataApi.getPois).mockResolvedValue([]);
    renderRedirect();
    await waitFor(() => expect(screen.getByText('logistics-page')).toBeInTheDocument());
  });

  it('redirects to technology when POIs exist', async () => {
    vi.mocked(defaultProjectsDataApi.getPois).mockResolvedValue([
      { id: 'poi-1', name: 'P', project_id: 'p1' },
    ] as never);
    renderRedirect();
    await waitFor(() => expect(screen.getByText('technology-page')).toBeInTheDocument());
  });

  it('redirects to technology without project', async () => {
    seedAppStore({ currentProjectId: null });
    vi.mocked(defaultProjectsDataApi.getPois).mockResolvedValue([]);
    const { api } = await import('../../lib/api');
    vi.mocked(api.projects).mockResolvedValue([] as never);
    renderPage(
      <Routes>
        <Route path="/flows" element={<FlowsIndexRedirect />} />
        <Route path="/flows/technology" element={<div>technology-bare</div>} />
      </Routes>,
      { initialEntries: ['/flows'] },
    );
    await waitFor(() => expect(screen.getByText('technology-bare')).toBeInTheDocument());
  });

  it('redirects to last visited flows tab when saved', async () => {
    sessionStorage.setItem('dm-nav-last-section:flows', '/flows/economic');
    renderRedirect();
    await waitFor(() => expect(screen.getByText('economic-page')).toBeInTheDocument());
  });
});
