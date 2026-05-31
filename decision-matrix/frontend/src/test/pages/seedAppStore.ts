import { vi } from 'vitest';
import { useAppStore } from '../../store';
import { useAuthStore } from '../../store';
import type { AuthUser } from '../../lib/api';
import { testAdmin } from '../fixtures/users';

export type SeedAppStoreOptions = {
  currentProjectId?: string | null;
  pushToast?: ReturnType<typeof vi.fn>;
};

export function seedAppStore(opts: SeedAppStoreOptions = {}) {
  const pushToast = opts.pushToast ?? vi.fn();
  useAppStore.setState({
    currentProjectId: opts.currentProjectId ?? 'p1',
    pushToast,
  });
  return { pushToast };
}

export function seedAuthUser(user: Partial<AuthUser> | null = null, isLoading = false) {
  const base: AuthUser = {
    id: testAdmin.id,
    email: testAdmin.email,
    username: testAdmin.username,
    role: testAdmin.role,
    ...user,
  };
  useAuthStore.setState({
    user: user === null ? null : base,
    isLoading,
  });
}
