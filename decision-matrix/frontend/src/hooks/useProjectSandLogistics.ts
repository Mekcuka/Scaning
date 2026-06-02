import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { normalizeSandLogisticsResult } from '../lib/sandLogisticsResult';

/** Last sand logistics result persisted on the project (GET from API). */
export function useProjectSandLogistics(projectId: string | null | undefined) {
  return useQuery({
    queryKey: ['sand-logistics', projectId],
    queryFn: async () => {
      if (!projectId) return null;
      const data = await api.getSandLogisticsResult(projectId);
      return data ? normalizeSandLogisticsResult(data) : null;
    },
    enabled: Boolean(projectId),
    staleTime: 60_000,
  });
}
