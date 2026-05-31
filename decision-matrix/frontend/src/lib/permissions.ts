export type UserRole = 'admin' | 'analyst' | 'data_manager' | 'viewer';

export type PermissionAction =
  | 'manage_users'
  | 'create_project'
  | 'write_project'
  | 'write_infra'
  | 'read';

const ROLE_PERMISSIONS: Record<UserRole, Set<PermissionAction>> = {
  admin: new Set(['manage_users', 'create_project', 'write_project', 'write_infra', 'read']),
  analyst: new Set(['create_project', 'write_project', 'write_infra', 'read']),
  data_manager: new Set(['write_infra', 'read']),
  viewer: new Set(['read']),
};

export function normalizeRole(role: string | undefined | null): UserRole {
  if (role === 'admin' || role === 'analyst' || role === 'data_manager' || role === 'viewer') {
    return role;
  }
  return 'viewer';
}

export function hasRole(role: string | undefined | null, ...allowed: UserRole[]): boolean {
  const r = normalizeRole(role);
  return allowed.includes(r);
}

export function can(role: string | undefined | null, action: PermissionAction): boolean {
  const r = normalizeRole(role);
  return ROLE_PERMISSIONS[r].has(action);
}

/** Delete project: creator or administrator only (matches backend AccessLevel.owner). */
export function canDeleteProject(
  role: string | undefined | null,
  userId: string | undefined | null,
  project: { owner_user_id?: string | null },
): boolean {
  if (normalizeRole(role) === 'admin') return true;
  if (!userId || !project.owner_user_id) return false;
  return project.owner_user_id === userId;
}

export const NAV_VISIBILITY: Record<string, UserRole[]> = {
  '/': ['admin', 'analyst', 'data_manager', 'viewer'],
  '/projects': ['admin', 'analyst', 'viewer'],
  '/map': ['admin', 'analyst', 'data_manager', 'viewer'],
  '/parameters': ['admin', 'analyst', 'viewer'],
  '/flows': ['admin', 'analyst', 'viewer'],
  '/matrix': ['admin', 'analyst', 'viewer'],
  '/report': ['admin', 'analyst', 'viewer'],
  '/import': ['admin', 'analyst', 'data_manager'],
  '/admin': ['admin'],
};

export function canSeeNav(role: string | undefined | null, path: string): boolean {
  const allowed = NAV_VISIBILITY[path];
  if (!allowed) return true;
  return hasRole(role, ...allowed);
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Администратор',
  analyst: 'Аналитик',
  data_manager: 'Менеджер данных',
  viewer: 'Наблюдатель',
};
