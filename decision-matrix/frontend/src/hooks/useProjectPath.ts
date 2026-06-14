import { useCallback } from 'react';
import { useParams } from 'react-router-dom';

import { isGlobalAppPath, projectPath } from '../lib/projectRoutes';
import { useActiveProject } from './useActiveProject';

/** Build URLs with current project id: p('/map') → /{id}/map */
export function useProjectPathBuilder() {
  const { projectId: routeProjectId } = useParams<{ projectId?: string }>();
  const { projectId: storeProjectId } = useActiveProject();
  const projectId = routeProjectId ?? storeProjectId;

  return useCallback(
    (suffix: string) => {
      const normalized = suffix.startsWith('/') ? suffix : `/${suffix}`;
      if (isGlobalAppPath(normalized)) return normalized;
      if (!projectId) return normalized;
      return projectPath(projectId, normalized);
    },
    [projectId],
  );
}
