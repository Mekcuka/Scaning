import { useQuery } from '@tanstack/react-query';
import { loadSandLogisticsFromSession } from '../lib/sandLogisticsResult';

/** Cached sand logistics result from session (after «Потоки → Логистика» analyze). */
export function useProjectSandLogistics(projectId: string | null | undefined) {
  return useQuery({
    queryKey: ['sand-logistics', projectId],
    queryFn: () => (projectId ? loadSandLogisticsFromSession(projectId) : null),
    enabled: Boolean(projectId),
    staleTime: Infinity,
  });
}
