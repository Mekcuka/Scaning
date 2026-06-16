import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';

import type { InfraObject } from '../lib/api';
import { padEarthworkApi } from '../lib/api/padEarthworkApi';
import { wellTrajectoryApi } from '../lib/api/wellTrajectoryApi';
import { buildProjectPadClusteringSummary } from '../lib/padClusteringProjectSummary';
import { wellTrajectoryQueryKeys } from './useWellTrajectoryGeoJson';

export function usePadClusteringProjectSummary(
  projectId: string | null | undefined,
  pads: InfraObject[],
  infraObjects: InfraObject[],
) {
  const padIds = useMemo(() => pads.map((pad) => pad.id), [pads]);

  const earthworkQueries = useQueries({
    queries: padIds.map((padId) => ({
      queryKey: ['padEarthworkLast', projectId, padId] as const,
      queryFn: () => padEarthworkApi.getLast(projectId!, padId),
      enabled: Boolean(projectId && padId),
      staleTime: 30_000,
    })),
  });

  const trajectoryQueries = useQueries({
    queries: padIds.map((padId) => ({
      queryKey: wellTrajectoryQueryKeys(projectId!, padId).last,
      queryFn: () => wellTrajectoryApi.getLast(projectId!, padId),
      enabled: Boolean(projectId && padId),
      staleTime: 30_000,
    })),
  });

  const isLoading =
    Boolean(projectId && padIds.length > 0) &&
    (earthworkQueries.some((query) => query.isLoading) ||
      trajectoryQueries.some((query) => query.isLoading));

  const summary = useMemo(() => {
    const earthworkByPadId = new Map(
      padIds.map((padId, index) => [padId, earthworkQueries[index]?.data ?? null]),
    );
    const trajectoryByPadId = new Map(
      padIds.map((padId, index) => [padId, trajectoryQueries[index]?.data ?? null]),
    );
    return buildProjectPadClusteringSummary({
      pads,
      infraObjects,
      earthworkByPadId,
      trajectoryByPadId,
    });
  }, [pads, infraObjects, padIds, earthworkQueries, trajectoryQueries]);

  return {
    ...summary,
    isLoading,
  };
}
