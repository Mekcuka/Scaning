import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { EarthworkParametersPage } from './EarthworkParametersPage';
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

describe('EarthworkParametersPage', () => {
  beforeEach(() => {
    seedAppStore({ currentProjectId: 'p1' });
  });

  it('renders earthwork parameters table', async () => {
    const { api } = await import('../lib/api');
    vi.mocked(api.getInfraObjects).mockResolvedValue([
      makeInfraPoint({ subtype: 'substation', name: 'ПС-1' }),
    ] as never);
    renderPage(<EarthworkParametersPage />);
    await waitFor(() => expect(screen.getByText('Открыть карту')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('Длина, м')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('Поворот / НДС, °')).toBeInTheDocument());
    expect(screen.getByText('ПС-1')).toBeInTheDocument();
  });
});
