import { useAuthStore } from '../store';
import { can, hasRole, normalizeRole, type PermissionAction, type UserRole } from '../lib/permissions';

export function usePermissions() {
  const user = useAuthStore((s) => s.user);
  const role = normalizeRole(user?.role);

  return {
    role,
    user,
    hasRole: (...roles: UserRole[]) => hasRole(user?.role, ...roles),
    can: (action: PermissionAction) => can(user?.role, action),
    isReadOnly: role === 'viewer',
    canWriteProject: can(user?.role, 'write_project'),
    canWriteInfra: can(user?.role, 'write_infra'),
  };
}
