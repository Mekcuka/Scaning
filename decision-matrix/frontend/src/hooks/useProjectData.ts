import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { MAP_INFRA_STALE_MS } from '../lib/mapBboxUtils';
import { queryKeys } from '../lib/queryKeys';

type ProjectQueryOptions = {
  enabled?: boolean;
  staleTime?: number;
  refetchOnMount?: boolean | 'always';
};

function projectQueryKey<T extends readonly unknown[]>(
  base: (id: string) => T,
  projectId: string | undefined | null,
  fallback: T,
): T {
  return projectId ? base(projectId) : fallback;
}

export function useProjectInfraObjects(
  projectId: string | undefined | null,
  options: ProjectQueryOptions = {},
) {
  const { enabled = true, staleTime, refetchOnMount } = options;
  return useQuery({
    queryKey: projectQueryKey(queryKeys.infra, projectId, ['infra', ''] as const),
    queryFn: () => api.getInfraObjects(projectId!),
    enabled: !!projectId && enabled,
    ...(staleTime != null ? { staleTime } : {}),
    ...(refetchOnMount != null ? { refetchOnMount } : {}),
  });
}

export function useProjectPois(
  projectId: string | undefined | null,
  options: ProjectQueryOptions = {},
) {
  const { enabled = true, staleTime = MAP_INFRA_STALE_MS, refetchOnMount } = options;
  return useQuery({
    queryKey: projectQueryKey(queryKeys.pois, projectId, ['pois', ''] as const),
    queryFn: () => api.getPois(projectId!),
    enabled: !!projectId && enabled,
    staleTime,
    ...(refetchOnMount != null ? { refetchOnMount } : {}),
  });
}

export function useProjectLayers(
  projectId: string | undefined | null,
  options: ProjectQueryOptions = {},
) {
  const { enabled = true, staleTime = MAP_INFRA_STALE_MS, refetchOnMount } = options;
  return useQuery({
    queryKey: projectQueryKey(queryKeys.layers, projectId, ['layers', ''] as const),
    queryFn: () => api.getLayers(projectId!),
    enabled: !!projectId && enabled,
    staleTime,
    ...(refetchOnMount != null ? { refetchOnMount } : {}),
  });
}
