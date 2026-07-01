import { describe, expect, it, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePermissions } from '../usePermissions';
import { useAuthStore } from '../../store';
import { testAdmin, testViewer } from '../../test/fixtures/users';

describe('usePermissions', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null });
  });

  it('exposes viewer as read-only', () => {
    useAuthStore.setState({
      user: {
        id: testViewer.id,
        email: testViewer.email,
        username: testViewer.username,
        role: testViewer.role,
      },
    });
    const { result } = renderHook(() => usePermissions());
    expect(result.current.isReadOnly).toBe(true);
    expect(result.current.canWriteProject).toBe(false);
  });

  it('exposes admin write access', () => {
    useAuthStore.setState({
      user: {
        id: testAdmin.id,
        email: testAdmin.email,
        username: testAdmin.username,
        role: testAdmin.role,
      },
    });
    const { result } = renderHook(() => usePermissions());
    expect(result.current.isReadOnly).toBe(false);
    expect(result.current.canWriteProject).toBe(true);
    expect(result.current.hasRole('admin')).toBe(true);
  });
});
