import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { FootprintConnectionsParametersPage } from './FootprintConnectionsParametersPage';
import { renderPage } from '../test/pages/renderPage';
import { seedAppStore } from '../test/pages/seedAppStore';
import { makeInfraPoint } from '../test/fixtures/infra';

vi.mock('../lib/api', async (importOriginal) => {
  const { createApiMock } = await import('../test/pages/apiMockModule');
  return createApiMock(importOriginal);
});
vi.mock('../hooks/usePermissions', () => ({
  usePermissions: () => ({ canWriteProject: true }),
}));

describe('FootprintConnectionsParametersPage', () => {
  beforeEach(() => {
    seedAppStore({ currentProjectId: 'p1' });
    localStorage.clear();
  });

  it('renders template form and apply controls', async () => {
    const { api } = await import('../lib/api');
    vi.mocked(api.getFootprintConnectionTemplate).mockResolvedValue({
      project_id: 'p1',
      template: {},
    });
    vi.mocked(api.getInfraObjects).mockResolvedValue([
      makeInfraPoint({
        subtype: 'ground_pumping_station',
        name: 'БКНС_1',
        properties: { pad_length_m: 120, pad_width_m: 80, pad_rotation_deg: 180 },
      }),
    ] as never);
    renderPage(<FootprintConnectionsParametersPage />);
    await waitFor(() => expect(screen.getByText('Схема шаблона')).toBeInTheDocument());
    expect(screen.getByText('Шаблон подключений')).toBeInTheDocument();
    expect(screen.getByText('Применить на карте')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Применить ко всем' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Применить к подтипу' })).toBeDisabled();
  });

  it('shows project prompt without project', async () => {
    seedAppStore({ currentProjectId: null });
    renderPage(<FootprintConnectionsParametersPage />);
    expect(screen.getByText(/Выберите проект/i)).toBeInTheDocument();
  });
});
