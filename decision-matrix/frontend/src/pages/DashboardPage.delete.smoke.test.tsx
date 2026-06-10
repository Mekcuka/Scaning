import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { DashboardPage } from './DashboardPage';
import { renderWithProviders } from '../test/renderWithProviders';
import { makeProject } from '../test/fixtures/projects';
import { useAuthStore } from '../store';
import { testAnalyst } from '../test/fixtures/users';

const deleteMutate = vi.fn();

vi.mock('../lib/api', async (importOriginal) => {
  const { createApiMock } = await import('../test/pages/apiMockModule');
  return createApiMock(importOriginal);
});

vi.mock('../hooks/useDeleteProjectDialog', () => ({
  useDeleteProjectDialog: () => ({
    openDeleteDialog: vi.fn(),
    deleteMut: { mutate: deleteMutate, isPending: false },
    deleteConfirmModal: null,
  }),
}));

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: () => ({
      data: [makeProject({ id: 'p-del', name: 'To delete', owner_user_id: testAnalyst.id })],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    }),
  };
});

describe('DashboardPage delete smoke', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: {
        id: testAnalyst.id,
        email: testAnalyst.email,
        username: testAnalyst.username,
        role: testAnalyst.role,
      },
    });
  });

  it('renders project table without error boundary', () => {
    renderWithProviders(<DashboardPage />);
    expect(screen.getAllByText('To delete').length).toBeGreaterThan(0);
  });
});
