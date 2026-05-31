import { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { usePermissions } from '../hooks/usePermissions';
import type { UserRole } from '../lib/permissions';
import { useAppStore } from '../store';

type Props = {
  roles?: UserRole[];
};

export function RoleProtectedRoute({ roles }: Props) {
  const { hasRole } = usePermissions();
  const pushToast = useAppStore((s) => s.pushToast);
  const denied = Boolean(roles && !hasRole(...roles));

  useEffect(() => {
    if (denied) {
      pushToast('error', 'Недостаточно прав для доступа к этому разделу');
    }
  }, [denied, pushToast]);

  if (denied) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
