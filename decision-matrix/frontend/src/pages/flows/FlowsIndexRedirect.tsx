import { Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { defaultProjectsDataApi } from '../../lib/api';
import { useActiveProject } from '../../hooks/useActiveProject';
import { getSavedSectionPath, sectionRelativePath } from '../../lib/sectionNavMemory';

/** Default flows tab: last visited, else logistics when no POI, else technology. */
export function FlowsIndexRedirect() {
  const saved = getSavedSectionPath('flows');
  const { projectId } = useActiveProject();
  const { data: pois = [], isLoading } = useQuery({
    queryKey: ['pois', projectId],
    queryFn: () => defaultProjectsDataApi.getPois(projectId!),
    enabled: !!projectId && !saved,
  });

  if (saved) {
    return <Navigate to={sectionRelativePath('flows')} replace />;
  }
  if (!projectId) return <Navigate to="technology" replace />;
  if (isLoading) return null;
  if (pois.length === 0) return <Navigate to="logistics" replace />;
  return <Navigate to="technology" replace />;
}
