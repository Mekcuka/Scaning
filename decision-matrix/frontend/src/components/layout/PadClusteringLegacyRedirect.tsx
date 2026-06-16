import { Navigate, useLocation, useParams } from 'react-router-dom';

import { getLastSectionPath } from '../../lib/sectionNavMemory';
import { projectPath } from '../../lib/projectRoutes';

/** Legacy `/pad-clustering/:projectId` → last visited sub-route (default workspace). */
export function PadClusteringLegacyRedirect() {
  const { projectId } = useParams<{ projectId: string }>();
  const location = useLocation();
  if (!projectId) {
    return <Navigate to="/projects" replace />;
  }
  const suffix = getLastSectionPath('pad-clustering');
  return (
    <Navigate
      to={projectPath(projectId, suffix) + location.search + location.hash}
      replace
    />
  );
}
