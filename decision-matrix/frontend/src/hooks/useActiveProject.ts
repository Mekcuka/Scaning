import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, type Project } from '../lib/api';
import { useAppStore } from '../store';

/** Ensures currentProjectId points to an existing project for the logged-in user. */
export function useActiveProject() {
  const projectId = useAppStore((s) => s.currentProjectId);
  const setCurrentProjectId = useAppStore((s) => s.setCurrentProjectId);

  const { data: projects = [], isLoading, isError } = useQuery({
    queryKey: ['projects'],
    queryFn: api.projects,
  });

  useEffect(() => {
    if (isLoading || projects.length === 0) return;
    const valid = projectId && projects.some((p) => p.id === projectId);
    if (!valid) {
      setCurrentProjectId(projects[0].id);
    }
  }, [isLoading, projects, projectId, setCurrentProjectId]);

  const activeProject: Project | null =
    projects.find((p) => p.id === projectId) ?? projects[0] ?? null;

  const resolvedId = activeProject?.id ?? null;

  return {
    projectId: resolvedId,
    activeProject,
    projects,
    isLoading,
    isError,
    setProjectId: setCurrentProjectId,
    hasProjects: projects.length > 0,
  };
}
