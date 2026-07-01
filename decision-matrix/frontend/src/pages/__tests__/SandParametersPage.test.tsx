import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { SandParametersPage } from '../SandParametersPage';
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
vi.mock('../../hooks/useProjectSandLogistics', () => ({
  useProjectSandLogistics: () => ({ data: null, isLoading: false }),
}));

describe('SandParametersPage', () => {
  beforeEach(() => {
    seedAppStore({ currentProjectId: 'p1' });
  });

  it('renders sand parameters page', async () => {
    const { api } = await import('../../lib/api');
    vi.mocked(api.getInfraObjects).mockResolvedValue([
      makeInfraPoint({ subtype: 'well', properties: { sand_demand_m3: 100 } }),
    ] as never);
    renderPage(<SandParametersPage />);
    await waitFor(() => expect(screen.getByText('Открыть карту')).toBeInTheDocument());
    await waitFor(() =>
      expect(screen.getByText(/спрос потребителей/i)).toBeInTheDocument(),
    );
  });

});
