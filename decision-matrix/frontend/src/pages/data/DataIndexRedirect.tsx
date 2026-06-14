import { Navigate } from 'react-router-dom';
import { usePermissions } from '../../hooks/usePermissions';
import { useActiveProject } from '../../hooks/useActiveProject';
import { canSeeNav } from '../../lib/permissions';
import { getSavedSectionPath } from '../../lib/sectionNavMemory';
import { useAuthStore } from '../../store';

/** Default data tab: last visited, else first sub-route the user can access. */
export function DataIndexRedirect() {
  const saved = getSavedSectionPath('data');
  const { role } = usePermissions();
  const user = useAuthStore((s) => s.user);
  const { activeProject } = useActiveProject();
  const navCtx = { userId: user?.id, activeProject };

  if (saved) {
    return <Navigate to={saved.replace(/^\/data\//, '')} replace />;
  }

  if (canSeeNav(role, '/data/import', navCtx)) {
    return <Navigate to="import" replace />;
  }
  if (canSeeNav(role, '/data/export', navCtx)) {
    return <Navigate to="export" replace />;
  }
  if (canSeeNav(role, '/data/import-3d', navCtx)) {
    return <Navigate to="import-3d" replace />;
  }

  return <Navigate to=".." replace />;
}
