import { Navigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { defaultProjectsDataApi } from '../../lib/api';
import { useActiveProject } from '../../hooks/useActiveProject';
import { getSavedSectionPath } from '../../lib/sectionNavMemory';
import { projectPath } from '../../lib/projectRoutes';

/** Default flows tab: last visited, else logistics when no POI, else technology. */
export function FlowsIndexRedirect() {
  const saved = getSavedSectionPath('flows');
  const routeProjectId = useParams().projectId;
  const { projectId, isLoading: projectLoading } = useActiveProject();
  const effectiveProjectId = projectId ?? routeProjectId;

  const { data: pois = [], isLoading: poisLoading } = useQuery({
    queryKey: ['pois', effectiveProjectId],
    queryFn: () => defaultProjectsDataApi.getPois(effectiveProjectId!),
    enabled: !!effectiveProjectId && !saved,
  });

  if (saved) {
    return (
      <Navigate
        to={effectiveProjectId ? projectPath(effectiveProjectId, saved) : saved}
        replace
      />
    );
  }
  if (!effectiveProjectId) {
    if (projectLoading) return null;
    return <Navigate to="/flows/technology" replace />;
  }
  if (poisLoading) return null;
  if (pois.length === 0) {
    return <Navigate to={projectPath(effectiveProjectId, '/flows/logistics')} replace />;
  }
  return <Navigate to={projectPath(effectiveProjectId, '/flows/technology')} replace />;
}
