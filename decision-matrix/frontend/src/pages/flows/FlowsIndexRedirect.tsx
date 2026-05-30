import { Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAppStore } from '../../store';

/** Default flows tab: logistics when no POI, otherwise technology. */
export function FlowsIndexRedirect() {
  const projectId = useAppStore((s) => s.currentProjectId);
  const { data: pois = [], isLoading } = useQuery({
    queryKey: ['pois', projectId],
    queryFn: () => api.getPois(projectId!),
    enabled: !!projectId,
  });

  if (!projectId) return <Navigate to="technology" replace />;
  if (isLoading) return null;
  if (pois.length === 0) return <Navigate to="logistics" replace />;
  return <Navigate to="technology" replace />;
}
