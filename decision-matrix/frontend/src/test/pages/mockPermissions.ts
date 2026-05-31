import { vi } from 'vitest';

export type MockPermissionsOptions = {
  canWriteProject?: boolean;
  canWriteInfra?: boolean;
  isAdmin?: boolean;
  can?: (action: string) => boolean;
};

const defaultCan = () => true;

export function mockPermissionsModule(opts: MockPermissionsOptions = {}) {
  const canWriteProject = opts.canWriteProject ?? true;
  const canWriteInfra = opts.canWriteInfra ?? true;
  const canFn = opts.can ?? defaultCan;

  vi.mock('../../hooks/usePermissions', () => ({
    usePermissions: () => ({
      canWriteProject,
      canWriteInfra,
      canDeleteProject: canWriteProject,
      isAdmin: opts.isAdmin ?? false,
      can: canFn,
    }),
  }));
}
