import { Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { defaultProjectsDataApi } from '../../lib/api';
import { getSavedSectionPath } from '../../lib/sectionNavMemory';
import { useAppStore } from '../../store';

/** Default flows tab: last visited, else logistics when no POI, else technology. */
export function FlowsIndexRedirect() {
  const saved = getSavedSectionPath('flows');
  const projectId = useAppStore((s) => s.currentProjectId);
  const { data: pois = [], isLoading } = useQuery({
    queryKey: ['pois', projectId],
    queryFn: () => defaultProjectsDataApi.getPois(projectId!),
    enabled: !!projectId && !saved,
  });

  if (saved) {
    return <Navigate to={saved} replace />;
  }
  if (!projectId) return <Navigate to="technology" replace />;
  if (isLoading) return null;
  if (pois.length === 0) return <Navigate to="logistics" replace />;
  return <Navigate to="technology" replace />;
}
