import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
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
  const projectId = useAppStore((s) => s.currentProjectId);
  const setCurrentProjectId = useAppStore((s) => s.setCurrentProjectId);

  const { data, isLoading, isFetched, isError } = useQuery({
    queryKey: queryKeys.projects,
    queryFn: projectsApi.projects,
  });

  const projects = normalizeProjectsList(data);

  const activeProject = useMemo((): Project | null => {
    if (projects.length === 0) return null;
    if (projectId) {
      const match = projects.find((p) => p.id === projectId);
      if (match) return match;
    }
    return projects[0] ?? null;
  }, [projects, projectId]);

  useEffect(() => {
    if (!isFetched) return;
    if (projects.length === 0) {
      if (projectId != null) setCurrentProjectId(null);
      return;
    }
    const exists = projectId != null && projects.some((p) => p.id === projectId);
    if (!exists) {
      const nextId = projects[0]?.id;
      if (nextId && nextId !== projectId) {
        setCurrentProjectId(nextId);
      }
    }
  }, [isFetched, projects, projectId, setCurrentProjectId]);

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
