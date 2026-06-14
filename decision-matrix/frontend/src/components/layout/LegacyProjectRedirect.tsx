import { Navigate, useLocation } from 'react-router-dom';

import { useActiveProject } from '../../hooks/useActiveProject';
import { legacyPrefixToSuffixPath, projectPath } from '../../lib/projectRoutes';
import { RouteFallback } from '../../routes/lazyPages';

type Props = {
  /** Logical path without project id, e.g. `/map` or `/parameters/rates`. Empty = dashboard. */
  suffix?: string;
};

/** Redirect bare legacy URLs (/map) to /map/{projectId} using active project. */
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

/** Preserve full legacy path (/parameters/sand → /parameters/sand/{projectId}). */
export function LegacyPathPreserveRedirect() {
  const location = useLocation();
  return <LegacyProjectRedirect suffix={location.pathname} />;
}

/** Redirect legacy /{projectId}/… prefix URLs to suffix form (/map/{projectId}). */
export function LegacyPrefixRedirect() {
  const location = useLocation();
  const target = legacyPrefixToSuffixPath(location.pathname);
  if (!target) {
    return <Navigate to="/projects" replace />;
  }
  return <Navigate to={target + location.search + location.hash} replace />;
}
