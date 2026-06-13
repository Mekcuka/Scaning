import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImportPage } from './ImportPage';
import { renderPage } from '../test/pages/renderPage';
import { seedAppStore } from '../test/pages/seedAppStore';
vi.mock('../lib/api', async (importOriginal) => {
  const { createApiMock } = await import('../test/pages/apiMockModule');
  return createApiMock(importOriginal);
});
vi.mock('../hooks/usePermissions', () => ({
  usePermissions: () => ({ canWriteProject: true, canWriteInfra: true }),
}));

describe('ImportPage', () => {
  beforeEach(() => {
    seedAppStore({ currentProjectId: 'p1' });
  });

  it('renders import page', async () => {
    renderPage(<ImportPage />);
    expect(screen.getByText('Импорт данных')).toBeInTheDocument();
    expect(screen.getByText('Подключение API')).toBeInTheDocument();
  });

  it('imports csv via file input', async () => {
    const { api } = await import('../lib/api');
    renderPage(<ImportPage />);
    const input = document.querySelector(
      'input[type="file"][accept*=".geojson"]',
    ) as HTMLInputElement;
    expect(input).toBeTruthy();
    const file = new File(['name,type,lat,lon\np,node,1,2'], 'test.csv', { type: 'text/csv' });
    await userEvent.upload(input as HTMLInputElement, file);
    await waitFor(() => expect(api.importCsv).toHaveBeenCalled());
  });

  it('shows message without projects', async () => {
    const { api } = await import('../lib/api');
    vi.mocked(api.projects).mockResolvedValueOnce([]);
    seedAppStore({ currentProjectId: null });
    renderPage(<ImportPage />);
    await waitFor(() =>
      expect(screen.getByText(/Создайте проект на странице/)).toBeInTheDocument(),
    );
  });
});
