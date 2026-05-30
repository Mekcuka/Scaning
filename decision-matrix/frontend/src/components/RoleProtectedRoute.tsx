import { Navigate, Outlet } from 'react-router-dom';
import { usePermissions } from '../hooks/usePermissions';
import type { UserRole } from '../lib/permissions';

type Props = {
  roles?: UserRole[];
};

export function RoleProtectedRoute({ roles }: Props) {
  const { hasRole } = usePermissions();

  if (roles && !hasRole(...roles)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
