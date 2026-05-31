import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { RoleProtectedRoute } from './RoleProtectedRoute';

vi.mock('../hooks/usePermissions', () => ({
  usePermissions: () => ({ hasRole: () => false }),
}));

vi.mock('../store', () => ({
  useAppStore: (selector: (s: { pushToast: () => void }) => unknown) =>
    selector({ pushToast: vi.fn() }),
}));

describe('RoleProtectedRoute', () => {
  it('redirects when role is missing', () => {
    render(
      <MemoryRouter initialEntries={['/import']}>
        <Routes>
          <Route element={<RoleProtectedRoute roles={['admin']} />}>
            <Route path="/import" element={<div>Secret</div>} />
          </Route>
          <Route path="/" element={<div>Home</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('Home')).toBeInTheDocument();
  });
});
