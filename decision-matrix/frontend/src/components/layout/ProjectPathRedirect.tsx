import { Navigate, useParams } from 'react-router-dom';
import { projectPath } from '../../lib/projectRoutes';

/** Redirect /old/{projectId} → /new/{projectId} (same project id). */
export function ProjectPathRedirect({ suffix }: { suffix: string }) {
  const { projectId } = useParams<{ projectId: string }>();
  if (!projectId) {
    return <Navigate to="/projects" replace />;
  }
  return <Navigate to={projectPath(projectId, suffix)} replace />;
}
