import { useEffect } from 'react';
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import {
  defaultSandLogisticsReadApi,
  type SandLogisticsReadApiPort,
} from '../lib/api';
import {
  loadSandLogisticsSessionCache,
  normalizeSandLogisticsResult,
  saveSandLogisticsSessionCache,
} from '../lib/sandLogisticsResult';

const SAND_LOGISTICS_QUERY_KEY = 'sand-logistics';

/** One GET per project per tab session unless cache was cleared (e.g. logout / invalidate). */
const SAND_LOGISTICS_STALE_MS = Number.POSITIVE_INFINITY;
const SAND_LOGISTICS_GC_MS = 2 * 60 * 60 * 1000;

export function sandLogisticsQueryKey(projectId: string | null | undefined) {
  return [SAND_LOGISTICS_QUERY_KEY, projectId] as const;
}

/** Restore last result from sessionStorage when React Query cache is empty (e.g. after F5). */
export function hydrateSandLogisticsFromSession(
  queryClient: QueryClient,
  projectId: string,
): boolean {
  if (queryClient.getQueryData(sandLogisticsQueryKey(projectId)) != null) return false;
  const session = loadSandLogisticsSessionCache(projectId);
  if (!session) return false;
  queryClient.setQueryData(sandLogisticsQueryKey(projectId), session);
  return true;
}

export function writeSandLogisticsCache(
  queryClient: QueryClient,
  projectId: string,
  result: ReturnType<typeof normalizeSandLogisticsResult>,
): void {
  queryClient.setQueryData(sandLogisticsQueryKey(projectId), result);
  saveSandLogisticsSessionCache(projectId, result);
}

export type UseProjectSandLogisticsOptions = {
  sandLogisticsApi?: SandLogisticsReadApiPort;
};

/** Last sand logistics result: DB on first open, then in-memory (+ sessionStorage) until invalidate. */
export function useProjectSandLogistics(
  projectId: string | null | undefined,
  options: UseProjectSandLogisticsOptions = {},
) {
  const sandLogisticsApi = options.sandLogisticsApi ?? defaultSandLogisticsReadApi;
  const queryClient = useQueryClient();

  useEffect(() => {
    if (projectId) hydrateSandLogisticsFromSession(queryClient, projectId);
  }, [projectId, queryClient]);

  return useQuery({
    queryKey: sandLogisticsQueryKey(projectId),
    queryFn: async () => {
      if (!projectId) return null;
      const data = await sandLogisticsApi.getSandLogisticsResult(projectId);
      const normalized = data ? normalizeSandLogisticsResult(data) : null;
      if (normalized) saveSandLogisticsSessionCache(projectId, normalized);
      return normalized;
    },
    enabled: Boolean(projectId),
    staleTime: SAND_LOGISTICS_STALE_MS,
    gcTime: SAND_LOGISTICS_GC_MS,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    placeholderData: keepPreviousData,
  });
}
