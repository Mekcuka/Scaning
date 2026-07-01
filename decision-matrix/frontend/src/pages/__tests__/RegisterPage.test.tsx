import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import { RegisterPage } from '../RegisterPage';
import { renderPage } from '../../test/pages/renderPage';
import { useAuthStore } from '../../store';

const navigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigate };
});

describe('RegisterPage', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    navigate.mockClear();
    useAuthStore.setState({
      register: vi.fn().mockResolvedValue(undefined),
    });
  });

  it('renders registration form', () => {
    renderPage(<RegisterPage />, { route: '/register' });
    expect(screen.getByText('Регистрация')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Зарегистрироваться' })).toBeInTheDocument();
  });

  it('has link to login', () => {
    renderPage(<RegisterPage />, { route: '/register' });
    expect(screen.getByRole('link', { name: 'Войти' })).toHaveAttribute('href', '/login');
  });
});
