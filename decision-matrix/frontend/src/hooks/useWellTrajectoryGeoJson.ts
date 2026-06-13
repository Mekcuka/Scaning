import { useQuery } from '@tanstack/react-query';
import { wellTrajectoryApi } from '../lib/api/wellTrajectoryApi';

export function useWellTrajectoryProjectGeoJson(projectId: string | null | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['wellTrajectoryProjectGeoJson', projectId],
    queryFn: () => wellTrajectoryApi.getProjectGeoJson(projectId!),
    enabled: Boolean(projectId && enabled),
    staleTime: 30_000,
  });
}

export function wellTrajectoryQueryKeys(projectId: string, objectId: string) {
  return {
    last: ['wellTrajectoryLast', projectId, objectId] as const,
    geoJson: ['wellTrajectoryGeoJson', projectId, objectId] as const,
  };
}
