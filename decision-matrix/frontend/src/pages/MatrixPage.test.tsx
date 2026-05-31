import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { MatrixPage } from './MatrixPage';
import { renderPage } from '../test/pages/renderPage';
import { seedAppStore } from '../test/pages/seedAppStore';
vi.mock('../lib/api', async (importOriginal) => {
  const { createApiMock } = await import('../test/pages/apiMockModule');
  return createApiMock(importOriginal);
});
vi.mock('../hooks/usePermissions', () => ({
  usePermissions: () => ({ canWriteProject: true }),
}));
vi.mock('../hooks/useMediaQuery', () => ({
  useIsMobile: () => false,
}));
vi.mock('../components/MapView3D', () => ({
  default: () => <div data-testid="mock-matrix-3d" />,
}));

describe('MatrixPage', () => {
  beforeEach(() => {
    seedAppStore({ currentProjectId: 'p1' });
  });

  it('renders matrix heading', async () => {
    renderPage(<MatrixPage />);
    expect(screen.getByText('Матрица решений')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Таблица' })).toBeInTheDocument());
  });

});
