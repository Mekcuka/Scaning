import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { QueryClient } from '@tanstack/react-query';
import { cleanup, screen, waitFor } from '@testing-library/react';
import { MatrixPage } from '../MatrixPage';
import { renderPage } from '../../test/pages/renderPage';
import { seedAppStore } from '../../test/pages/seedAppStore';
import { createTestQueryClient } from '../../test/renderWithProviders';
vi.mock('../../lib/api', async (importOriginal) => {
  const { createApiMock } = await import('../../test/pages/apiMockModule');
  return createApiMock(importOriginal);
});
vi.mock('../../hooks/usePermissions', () => ({
  usePermissions: () => ({ canWriteProject: true }),
}));
vi.mock('../../hooks/useMediaQuery', () => ({
  useIsMobile: () => false,
}));

describe('MatrixPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    seedAppStore({ currentProjectId: 'p1' });
  });

  afterEach(async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    cleanup();
  });

  it('renders matrix heading', async () => {
    renderPage(<MatrixPage />, { queryClient });
    expect(screen.getByText('Матрица решений')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Таблица' })).toBeInTheDocument());
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
  });

});
