import { Navigate, useParams } from 'react-router-dom';
import { useActiveProject } from '../../hooks/useActiveProject';
import { projectPath } from '../../lib/projectRoutes';
import { getLastSectionPath, type NavSection } from '../../lib/sectionNavMemory';

/** Redirect section index to last visited sub-route (or default). */
export function SectionIndexRedirect({ section }: { section: NavSection }) {
  const routeProjectId = useParams().projectId;
  const { projectId } = useActiveProject();
  const effectiveProjectId = projectId ?? routeProjectId;
  const logical = getLastSectionPath(section);
  if (!effectiveProjectId) {
    return <Navigate to={logical} replace />;
  }
  return <Navigate to={projectPath(effectiveProjectId, logical)} replace />;
}
