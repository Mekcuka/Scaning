import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { AdminLayout } from '../components/layout/AdminLayout';
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
        created_at: '2024-06-01T10:00:00.000Z',
        last_login_at: '2024-06-02T15:30:00.000Z',
      },
    ] as never);
  });

  it('renders admin heading and stats', async () => {
    renderPage(
      <Routes>
        <Route path="/admin" element={<AdminLayout />}>
          <Route path="users" element={<AdminUsersPage />} />
        </Route>
      </Routes>,
      { initialEntries: ['/admin/users'] },
    );
    expect(screen.getByText('Администрирование')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('a@test.ru')).toBeInTheDocument());
    expect(screen.getByRole('link', { name: /Пользователи/i })).toBeInTheDocument();
    expect(screen.getByText('Зарегистрирован')).toBeInTheDocument();
    expect(screen.getByText('Последний вход')).toBeInTheDocument();
    expect(screen.getByText('01.06.2024, 13:00:00')).toBeInTheDocument();
    expect(screen.getByText('02.06.2024, 18:30:00')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    vi.mocked(api.adminUsers).mockImplementation(() => new Promise(() => {}));
    renderPage(
      <Routes>
        <Route path="/admin" element={<AdminLayout />}>
          <Route path="users" element={<AdminUsersPage />} />
        </Route>
      </Routes>,
      { initialEntries: ['/admin/users'] },
    );
    expect(screen.getByText('Загрузка...')).toBeInTheDocument();
  });
});
