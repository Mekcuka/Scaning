import { Navigate, useParams } from 'react-router-dom';
import { usePermissions } from '../../hooks/usePermissions';
import { useActiveProject } from '../../hooks/useActiveProject';
import { canSeeNav } from '../../lib/permissions';
import { getSavedSectionPath } from '../../lib/sectionNavMemory';
import { projectPath } from '../../lib/projectRoutes';
import { useAuthStore } from '../../store';

/** Default data tab: last visited, else first sub-route the user can access. */
export function DataIndexRedirect() {
  const saved = getSavedSectionPath('data');
  const routeProjectId = useParams().projectId;
  const { role } = usePermissions();
  const user = useAuthStore((s) => s.user);
  const { activeProject, projectId } = useActiveProject();
  const effectiveProjectId = projectId ?? routeProjectId;
  const navCtx = { userId: user?.id, activeProject };

  if (saved) {
    return (
      <Navigate
        to={effectiveProjectId ? projectPath(effectiveProjectId, saved) : saved}
        replace
      />
    );
  }

  if (canSeeNav(role, '/data/import', navCtx)) {
    return (
      <Navigate
        to={
          effectiveProjectId ? projectPath(effectiveProjectId, '/data/import') : '/data/import'
        }
        replace
      />
    );
  }
  if (canSeeNav(role, '/data/export', navCtx)) {
    return (
      <Navigate
        to={
          effectiveProjectId ? projectPath(effectiveProjectId, '/data/export') : '/data/export'
        }
        replace
      />
    );
  }
  if (canSeeNav(role, '/data/import-3d', navCtx)) {
    return (
      <Navigate
        to={
          effectiveProjectId
            ? projectPath(effectiveProjectId, '/data/import-3d')
            : '/data/import-3d'
        }
        replace
      />
    );
  }

  return <Navigate to="/projects" replace />;
}
