import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { lineElevationProfileApi } from '../lib/api/lineElevationProfileApi';
import { formatDemApiError } from '../lib/demApiErrors';
import { useAppStore } from '../store';

export function useLineElevationProfileCompute(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const pushToast = useAppStore((s) => s.pushToast);

  const computeMut = useMutation({
    mutationFn: async () => {
      if (!projectId) throw new Error('Проект не выбран');
      return lineElevationProfileApi.compute(projectId);
    },
    onSuccess: async (result) => {
      if (projectId) {
        await queryClient.invalidateQueries({ queryKey: ['infra', projectId] });
        await queryClient.refetchQueries({ queryKey: ['infra', projectId] });
        await queryClient.invalidateQueries({ queryKey: ['lineElevationProfile', projectId] });
      }
      const computedCount =
        typeof result?.computed_count === 'number' ? result.computed_count : 0;
      const pointsUpdated =
        typeof result?.points_updated_count === 'number' ? result.points_updated_count : 0;
      const errorCount = Array.isArray(result?.errors) ? result.errors.length : 0;
      const errPart = errorCount > 0 ? ` Ошибки: ${errorCount}.` : '';
      const pointsPart =
        pointsUpdated > 0 ? ` Обновлено точек: ${pointsUpdated}.` : '';
      pushToast(
        'success',
        `Профиль рассчитан для ${computedCount} линий.${pointsPart}${errPart}`,
      );
    },
    onError: (err) => {
      const raw = err instanceof Error ? err.message : '';
      pushToast(
        'error',
        raw ? formatDemApiError(raw) : 'Не удалось рассчитать профиль',
      );
    },
  });

  const compute = useCallback(() => computeMut.mutate(), [computeMut]);

  return {
    compute,
    computePending: computeMut.isPending,
  };
}

export function useLineElevationProfileQuery(
  projectId: string | null | undefined,
  objectId: string | null | undefined,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['lineElevationProfile', projectId, objectId],
    queryFn: () => lineElevationProfileApi.getProfile(projectId!, objectId!),
    enabled: Boolean(projectId && objectId && enabled),
    retry: false,
    staleTime: 30_000,
  });
}
