import { Navigate, useLocation } from 'react-router-dom';

import { useActiveProject } from '../../hooks/useActiveProject';
import { projectPath } from '../../lib/projectRoutes';
import { RouteFallback } from '../../routes/lazyPages';

type Props = {
  /** Logical path without project prefix, e.g. `/map` or `/parameters/rates`. Empty = dashboard. */
  suffix?: string;
};

/** Redirect legacy URLs (/map) to /:projectId/map using active project. */
export function LegacyProjectRedirect({ suffix = '' }: Props) {
  const { projectId, isLoading, isFetched } = useActiveProject();
  const location = useLocation();

  if (isLoading && !isFetched) {
    return <RouteFallback />;
  }

  if (!projectId) {
    return <Navigate to="/projects" replace />;
  }

  const target = projectPath(projectId, suffix) + location.search + location.hash;
  return <Navigate to={target} replace />;
}

/** Preserve full legacy path (/parameters/sand → /:projectId/parameters/sand). */
export function LegacyPathPreserveRedirect() {
  const location = useLocation();
  return <LegacyProjectRedirect suffix={location.pathname} />;
}
