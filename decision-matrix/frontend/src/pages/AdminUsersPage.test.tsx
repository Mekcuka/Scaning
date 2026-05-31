import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { AdminUsersPage } from './AdminUsersPage';
import { renderPage } from '../test/pages/renderPage';
import { seedAppStore, seedAuthUser } from '../test/pages/seedAppStore';
import { api } from '../lib/api';

vi.mock('../lib/api', async (importOriginal) => {
  const { createApiMock } = await import('../test/pages/apiMockModule');
  return createApiMock(importOriginal);
});

describe('AdminUsersPage', () => {
  beforeEach(() => {
    seedAppStore();
    seedAuthUser({ role: 'admin' });
    vi.mocked(api.adminUsers).mockResolvedValue([
      {
        id: 'u1',
        email: 'a@test.ru',
        username: 'Admin',
        role: 'analyst',
        is_active: true,
        project_count: 2,
      },
    ] as never);
  });

  it('renders admin heading and stats', async () => {
    renderPage(<AdminUsersPage />);
    expect(screen.getByText('Администрирование')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('a@test.ru')).toBeInTheDocument());
    expect(screen.getByText('Пользователи')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    vi.mocked(api.adminUsers).mockImplementation(() => new Promise(() => {}));
    renderPage(<AdminUsersPage />);
    expect(screen.getByText('Загрузка...')).toBeInTheDocument();
  });
});
