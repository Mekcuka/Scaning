import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { FlowsIndexRedirect } from './FlowsIndexRedirect';
import { renderPage } from '../../test/pages/renderPage';
import { seedAppStore } from '../../test/pages/seedAppStore';
import { api } from '../../lib/api';

vi.mock('../../lib/api', async (importOriginal) => {
  const { createApiMock } = await import('../../test/pages/apiMockModule');
  return createApiMock(importOriginal);
});

function renderRedirect() {
  return renderPage(
    <Routes>
      <Route path="/flows" element={<FlowsIndexRedirect />} />
      <Route path="/flows/logistics" element={<div>logistics-page</div>} />
      <Route path="/flows/technology" element={<div>technology-page</div>} />
      <Route path="/flows/economic" element={<div>economic-page</div>} />
    </Routes>,
    { initialEntries: ['/flows'] },
  );
}

describe('FlowsIndexRedirect', () => {
  beforeEach(() => {
    sessionStorage.clear();
    seedAppStore({ currentProjectId: 'p1' });
  });

  it('redirects to logistics when no POIs', async () => {
    vi.mocked(api.getPois).mockResolvedValueOnce([]);
    renderRedirect();
    await waitFor(() => expect(screen.getByText('logistics-page')).toBeInTheDocument());
  });

  it('redirects to technology when POIs exist', async () => {
    vi.mocked(api.getPois).mockResolvedValueOnce([
      { id: 'poi-1', name: 'P', project_id: 'p1' },
    ] as never);
    renderRedirect();
    await waitFor(() => expect(screen.getByText('technology-page')).toBeInTheDocument());
  });

  it('redirects to technology without project', async () => {
    seedAppStore({ currentProjectId: null });
    renderRedirect();
    await waitFor(() => expect(screen.getByText('technology-page')).toBeInTheDocument());
  });

  it('redirects to last visited flows tab when saved', async () => {
    sessionStorage.setItem('dm-nav-last-section:flows', '/flows/economic');
    renderRedirect();
    await waitFor(() => expect(screen.getByText('economic-page')).toBeInTheDocument());
  });
});
