import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { ParametersPage } from './ParametersPage';
import { renderWithProviders } from '../test/renderWithProviders';
import { useAppStore } from '../store';

vi.mock('../lib/api', async (importOriginal) => {
  const { createApiMock } = await import('../test/pages/apiMockModule');
  return createApiMock(importOriginal, {
    getInfraObjects: vi.fn().mockResolvedValue([]),
  });
});

vi.mock('../hooks/usePermissions', () => ({
  usePermissions: () => ({ canWriteProject: true }),
}));

describe('ParametersPage smoke', () => {
  beforeEach(() => {
    useAppStore.setState({ currentProjectId: 'p1', pushToast: vi.fn() });
  });

  it('renders heading when project is selected', async () => {
    renderWithProviders(<ParametersPage />);
    await waitFor(() => expect(screen.getByText('Открыть карту')).toBeInTheDocument());
    expect(screen.getByRole('columnheader', { name: 'Пропускная способность' })).toBeInTheDocument();
  });
});
