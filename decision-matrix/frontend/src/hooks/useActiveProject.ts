import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import {
  defaultProjectsListApi,
  type Project,
  type ProjectsListApiPort,
} from '../lib/api';
import { normalizeProjectsList } from '../lib/normalizeProjectsList';
import { queryKeys } from '../lib/queryKeys';
import { useAppStore } from '../store';

export type UseActiveProjectOptions = {
  projectsApi?: ProjectsListApiPort;
};

/** Ensures currentProjectId points to an existing project for the logged-in user. */
export function useActiveProject(options: UseActiveProjectOptions = {}) {
  const projectsApi = options.projectsApi ?? defaultProjectsListApi;
  const { projectId: routeProjectId } = useParams<{ projectId?: string }>();
  const storeProjectId = useAppStore((s) => s.currentProjectId);
  const setCurrentProjectId = useAppStore((s) => s.setCurrentProjectId);
  const preferredProjectId = routeProjectId ?? storeProjectId;

  const { data, isLoading, isFetched, isError } = useQuery({
    queryKey: queryKeys.projects,
    queryFn: projectsApi.projects,
  });

  const projects = normalizeProjectsList(data);

  const activeProject = useMemo((): Project | null => {
    if (projects.length === 0) return null;
    if (preferredProjectId) {
      const match = projects.find((p) => p.id === preferredProjectId);
      if (match) return match;
    }
    return projects[0] ?? null;
  }, [projects, preferredProjectId]);

  useEffect(() => {
    if (!isFetched) return;
    if (projects.length === 0) {
      if (storeProjectId != null) setCurrentProjectId(null);
      return;
    }
    const exists =
      preferredProjectId != null && projects.some((p) => p.id === preferredProjectId);
    if (!exists && !routeProjectId) {
      const nextId = projects[0]?.id;
      if (nextId && nextId !== storeProjectId) {
        setCurrentProjectId(nextId);
      }
    }
  }, [isFetched, projects, preferredProjectId, routeProjectId, storeProjectId, setCurrentProjectId]);

  return {
    projectId: activeProject?.id,
    activeProject,
    projects,
    isLoading,
    isError,
    setProjectId: setCurrentProjectId,
    hasProjects: projects.length > 0,
  };
}
