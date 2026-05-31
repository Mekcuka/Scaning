import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginPage } from './LoginPage';
import { renderPage } from '../test/pages/renderPage';
import { useAuthStore } from '../store';

const navigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => navigate,
    Link: actual.Link,
  };
});

describe('LoginPage', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    navigate.mockClear();
    useAuthStore.setState({
      user: null,
      isLoading: false,
      login: vi.fn().mockResolvedValue(undefined),
    });
  });

  it('renders login form', () => {
    renderPage(<LoginPage />, { route: '/login' });
    expect(screen.getByText('СППР Нефтегаз')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Войти' })).toBeInTheDocument();
  });

  it('shows loading state', () => {
    useAuthStore.setState({ isLoading: true });
    renderPage(<LoginPage />, { route: '/login' });
    expect(screen.getAllByText('Загрузка...').length).toBeGreaterThan(0);
  });

  it('redirects when user already logged in', async () => {
    useAuthStore.setState({
      user: { id: 'u1', email: 'a@b.ru', username: 'u', role: 'analyst' },
      isLoading: false,
    });
    renderPage(<LoginPage />, { route: '/login' });
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/', { replace: true }));
  });

  it('submits credentials', async () => {
    const login = vi.fn().mockResolvedValue(undefined);
    useAuthStore.setState({ login });
    renderPage(<LoginPage />, { route: '/login' });
    await userEvent.type(screen.getByLabelText('Email'), 'user@test.ru');
    await userEvent.type(screen.getByLabelText('Пароль'), 'secret');
    await userEvent.click(screen.getByRole('button', { name: 'Войти' }));
    await waitFor(() => expect(login).toHaveBeenCalledWith('user@test.ru', 'secret'));
    expect(navigate).toHaveBeenCalledWith('/');
  });

  it('toggles password visibility', async () => {
    renderPage(<LoginPage />, { route: '/login' });
    const pwd = screen.getByLabelText('Пароль');
    expect(pwd).toHaveAttribute('type', 'password');
    await userEvent.click(screen.getByRole('button', { name: 'Показать пароль' }));
    expect(pwd).toHaveAttribute('type', 'text');
  });

  it('shows login error', async () => {
    useAuthStore.setState({
      login: vi.fn().mockRejectedValue(new Error('Неверный пароль')),
    });
    renderPage(<LoginPage />, { route: '/login' });
    await userEvent.type(screen.getByLabelText('Email'), 'user@test.ru');
    await userEvent.type(screen.getByLabelText('Пароль'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Войти' }));
    expect(await screen.findByText('Неверный пароль')).toBeInTheDocument();
  });
});
