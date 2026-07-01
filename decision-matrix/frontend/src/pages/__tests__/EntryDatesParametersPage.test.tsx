import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { EntryDatesParametersPage } from '../EntryDatesParametersPage';
import { renderPage } from '../../test/pages/renderPage';
import { seedAppStore } from '../../test/pages/seedAppStore';
import { makeInfraPoint } from '../../test/fixtures/infra';

vi.mock('../../lib/api', async (importOriginal) => {
  const { createApiMock } = await import('../../test/pages/apiMockModule');
  return createApiMock(importOriginal);
});
vi.mock('../../hooks/usePermissions', () => ({
  usePermissions: () => ({ canWriteProject: true }),
}));

describe('EntryDatesParametersPage', () => {
  beforeEach(() => {
    seedAppStore({ currentProjectId: 'p1' });
  });

  it('renders entry dates table', async () => {
    const { api } = await import('../../lib/api');
    vi.mocked(api.getInfraObjects).mockResolvedValue([
      makeInfraPoint({ subtype: 'well' }),
    ] as never);
    renderPage(<EntryDatesParametersPage />);
    await waitFor(() =>
      expect(screen.getByText(/Дата ввода в эксплуатацию/)).toBeInTheDocument(),
    );
  });

});
