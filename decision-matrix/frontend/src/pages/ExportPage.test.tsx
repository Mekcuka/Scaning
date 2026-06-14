import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExportPage } from './ExportPage';
import { renderPage } from '../test/pages/renderPage';
import { seedAppStore } from '../test/pages/seedAppStore';
import { makeInfraPoint } from '../test/fixtures/infra';

vi.mock('../lib/api', async (importOriginal) => {
  const { createApiMock } = await import('../test/pages/apiMockModule');
  return createApiMock(importOriginal);
});

describe('ExportPage', () => {
  beforeEach(() => {
    seedAppStore({ currentProjectId: 'p1' });
  });

  it('renders export options when project has infrastructure', async () => {
    const { api } = await import('../lib/api');
    vi.mocked(api.getInfraObjects).mockResolvedValue([
      makeInfraPoint({ subtype: 'gas_processing', name: 'ГПЗ_1' }),
    ] as never);
    renderPage(<ExportPage />);
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Excel' }).length).toBeGreaterThan(0));
    expect(screen.getAllByRole('button', { name: 'CSV' }).length).toBeGreaterThan(0);
  });

  it('shows info alert when there are no projects', async () => {
    seedAppStore({ currentProjectId: null });
    const { api } = await import('../lib/api');
    vi.mocked(api.projects).mockResolvedValue([] as never);
    renderPage(<ExportPage />);
    await waitFor(() => expect(screen.getByText(/Создайте проект/i)).toBeInTheDocument());
  });
});
