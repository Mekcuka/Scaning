import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store';

export function ProtectedRoute() {
  const { user, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div
        className="flex flex-1 min-h-0 items-center justify-center"
        style={{ color: 'var(--text-muted)' }}
      >
        Загрузка...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
