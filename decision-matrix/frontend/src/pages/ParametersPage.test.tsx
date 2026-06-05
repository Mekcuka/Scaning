import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { ParametersPage } from './ParametersPage';
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

describe('ParametersPage', () => {
  beforeEach(() => {
    seedAppStore({ currentProjectId: 'p1' });
  });

  it('renders parameters table', async () => {
    const { api } = await import('../lib/api');
    vi.mocked(api.getInfraObjects).mockResolvedValue([makeInfraPoint()] as never);
    renderPage(<ParametersPage />);
    await waitFor(() => expect(screen.getByText('Открыть карту')).toBeInTheDocument());
    await waitFor(() =>
      expect(screen.getByText('Пропускная способность')).toBeInTheDocument(),
    );
  });
});
