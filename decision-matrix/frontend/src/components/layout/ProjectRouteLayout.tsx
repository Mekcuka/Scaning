import { useEffect } from 'react';
import { Navigate, Outlet, useParams } from 'react-router-dom';

import { useActiveProject } from '../../hooks/useActiveProject';
import { projectPath } from '../../lib/projectRoutes';
import { RouteFallback } from '../../routes/lazyPages';

/** Syncs URL :projectId with store and validates access. */
export function ProjectRouteLayout() {
  const { projectId } = useParams<{ projectId: string }>();
  const { projects, isLoading, isFetched, setProjectId } = useActiveProject();

  useEffect(() => {
    if (!projectId || !isFetched) return;
    const exists = projects.some((p) => p.id === projectId);
    if (exists) setProjectId(projectId);
  }, [projectId, projects, isFetched, setProjectId]);

  if (isLoading && !isFetched) {
    return <RouteFallback />;
  }

  if (!projectId) {
    return <Navigate to="/projects" replace />;
  }

  if (isFetched && !projects.some((p) => p.id === projectId)) {
    if (projects[0]) {
      return <Navigate to={projectPath(projects[0].id)} replace />;
    }
    return <Navigate to="/projects" replace />;
  }

  return <Outlet />;
}
