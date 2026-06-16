import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { MapGroupSelectionItem } from '../components/MapGroupSelectionPanel';
import type { MapClickHit, MapFeatureSelection } from '../components/MapView';
import { padPlacementApi } from '../lib/api/padPlacementApi';
import type { InfraObject } from '../lib/api';
import {
  infraObjectInBbox,
  isPadPlacementBottomhole,
  mergeBottomholeIds,
} from '../lib/padPlacementEligibility';
import {
  defaultPadPlacementVariantIndex,
  findPadPlacementVariant,
  normalizePadPlacementComputeResponse,
} from '../lib/padPlacementCompute';
import { geoJsonToPreviewFeatures } from '../lib/padPlacementPreview';
import {
  DEFAULT_PAD_PLACEMENT_PARAMS,
  PAD_PLACEMENT_MAX_WELLS,
  type PadPlacementComputeResponse,
  type PadPlacementParams,
} from '../lib/padPlacementTypes';
import { isProjectJobCreateResponse, pollProjectJobUntilDone } from '../lib/pollProjectJob';
import { refreshMapQueries } from '../lib/mapQueries';
import { parseMapBbox } from '../lib/mapBboxUtils';
import { SUBTYPE_LABELS } from '../lib/api';

type DrawMode = 'select' | 'pad_placement' | string;

export type UseMapPadPlacementParams = {
  projectId: string | undefined;
  drawMode: DrawMode;
  setDrawMode: (mode: DrawMode) => void;
  infraObjects: InfraObject[];
  mapBbox: string | null;
  canWriteInfra: boolean;
  projectJobBusy: boolean;
  pushToast: (kind: 'success' | 'error' | 'info', message: string) => void;
  invalidateMap: () => void;
};

export function useMapPadPlacement({
  projectId,
  drawMode,
  setDrawMode,
  infraObjects,
  mapBbox,
  canWriteInfra,
  projectJobBusy,
  pushToast,
  invalidateMap,
}: UseMapPadPlacementParams) {
  const queryClient = useQueryClient();
  const [bottomholeIds, setBottomholeIds] = useState<string[]>([]);
  const [params, setParams] = useState<PadPlacementParams>(DEFAULT_PAD_PLACEMENT_PARAMS);
  const [subtype, setSubtype] = useState<'oil_pad' | 'gas_pad'>('oil_pad');
  const [computeResult, setComputeResult] = useState<PadPlacementComputeResponse | null>(null);
  const [selectedVariantIndex, setSelectedVariantIndex] = useState<number | null>(null);

  const clearComputeState = useCallback(() => {
    setComputeResult(null);
    setSelectedVariantIndex(null);
  }, []);

  useEffect(() => {
    if (drawMode !== 'pad_placement') {
      clearComputeState();
    }
  }, [drawMode, clearComputeState]);

  useEffect(() => {
    clearComputeState();
  }, [bottomholeIds, params, subtype, clearComputeState]);

  const bottomholeDetails: MapGroupSelectionItem[] = useMemo(
    () =>
      bottomholeIds
        .map((id) => infraObjects.find((o) => o.id === id))
        .filter(Boolean)
        .map((obj) => ({
          id: obj!.id,
          name: obj!.name,
          subtype: obj!.subtype,
          subtitle: SUBTYPE_LABELS[obj!.subtype] ?? obj!.subtype,
          kind: 'infra' as const,
        })),
    [bottomholeIds, infraObjects],
  );

  const previewQuery = useQuery({
    queryKey: ['pad-placement-preview', projectId, computeResult?.request_id, selectedVariantIndex],
    queryFn: () =>
      padPlacementApi.previewGeoJson(
        projectId!,
        computeResult!.request_id,
        selectedVariantIndex!,
      ),
    enabled:
      Boolean(projectId && computeResult?.request_id && selectedVariantIndex != null),
  });

  const previewFeatures = useMemo(
    () => geoJsonToPreviewFeatures(previewQuery.data),
    [previewQuery.data],
  );

  const applyComputeResult = useCallback(
    (raw: unknown) => {
      const data = normalizePadPlacementComputeResponse(raw);
      const nextIndex = defaultPadPlacementVariantIndex(data.variants);
      setComputeResult(data);
      setSelectedVariantIndex(nextIndex);
      if (data.variants.length === 0) {
        pushToast('info', 'Расчёт завершён, но подходящих вариантов не найдено');
        return;
      }
      const selected = findPadPlacementVariant(data, nextIndex);
      if (selected?.invalid) {
        pushToast(
          'info',
          'Выбранный вариант недопустим для применения — выберите другой или измените параметры',
        );
        return;
      }
      pushToast('success', `Готово: ${data.variants.length} вариант(ов)`);
    },
    [pushToast],
  );

  const computeMut = useMutation({
    mutationFn: async () => {
      if (!projectId || bottomholeIds.length === 0) {
        throw new Error('Выберите хотя бы один забой');
      }
      let ids = bottomholeIds;
      if (ids.length > PAD_PLACEMENT_MAX_WELLS) {
        pushToast(
          'info',
          `В расчёт пойдут первые ${PAD_PLACEMENT_MAX_WELLS} из ${ids.length} забоев`,
        );
        ids = ids.slice(0, PAD_PLACEMENT_MAX_WELLS);
      }
      const body = { bottomhole_ids: ids, params, subtype };
      const preview = await padPlacementApi.request(projectId, body);
      const useAsync = !preview.sync_allowed;
      if (useAsync) {
        pushToast(
          'info',
          `Большая выборка (${preview.logical_well_count} скв.) — расчёт в фоновой задаче…`,
        );
      }
      const res = await padPlacementApi.compute(projectId, body, { async: useAsync });
      if (isProjectJobCreateResponse(res)) {
        const done = await pollProjectJobUntilDone(projectId, res.job_id, {
          timeoutMs: 600_000,
        });
        let payload: unknown = done.result;
        if (
          !payload ||
          typeof payload !== 'object' ||
          !Array.isArray((payload as PadPlacementComputeResponse).variants) ||
          (payload as PadPlacementComputeResponse).variants.length === 0
        ) {
          payload = await padPlacementApi.getCompute(projectId, preview.request_id);
        }
        if (!payload) throw new Error('Пустой результат задачи');
        return payload;
      }
      return res;
    },
    onSuccess: (raw) => {
      applyComputeResult(raw);
      if (projectId) {
        void queryClient.invalidateQueries({ queryKey: ['activeJob', projectId] });
      }
    },
    onError: (e: Error) => pushToast('error', e.message),
  });

  const applyMut = useMutation({
    mutationFn: async () => {
      if (!projectId || !computeResult || selectedVariantIndex == null) {
        throw new Error('Сначала рассчитайте и выберите вариант');
      }
      const res = await padPlacementApi.apply(projectId, {
        request_id: computeResult.request_id,
        variant_index: selectedVariantIndex,
      });
      if (isProjectJobCreateResponse(res)) {
        await pollProjectJobUntilDone(projectId, res.job_id);
        return res;
      }
      return res;
    },
    onSuccess: (res) => {
      pushToast('success', 'Кусты созданы на карте');
      invalidateMap();
      void refreshMapQueries(queryClient, projectId!);
      if (projectId && res && typeof res === 'object' && 'created_pad_ids' in res) {
        const applied = res as { created_pad_ids?: string[] };
        for (const padId of applied.created_pad_ids ?? []) {
          void queryClient.invalidateQueries({
            queryKey: ['wellTrajectoryLast', projectId, padId],
          });
        }
      }
      setDrawMode('select');
    },
    onError: (e: Error) => pushToast('error', e.message),
  });

  const handleMapClick = useCallback(
    (_lon: number, _lat: number, hit?: MapClickHit) => {
      const id = hit?.overPoint?.id;
      if (!id) return;
      const obj = infraObjects.find((o) => o.id === id);
      if (!obj || !isPadPlacementBottomhole(obj)) return;
      setBottomholeIds((ids) => mergeBottomholeIds(ids, id));
    },
    [infraObjects],
  );

  const handleDragBoxPick = useCallback(
    (sels: MapFeatureSelection[]) => {
      const ids = sels
        .filter((s) => s.kind === 'infra')
        .map((s) => s.id)
        .filter((id) => {
          const obj = infraObjects.find((o) => o.id === id);
          return obj && isPadPlacementBottomhole(obj);
        });
      if (!ids.length) return;
      setBottomholeIds((prev) => Array.from(new Set([...prev, ...ids])));
    },
    [infraObjects],
  );

  const handleAddVisible = useCallback(() => {
    const bbox = parseMapBbox(mapBbox);
    if (!bbox) return;
    const ids = infraObjects
      .filter((o) => isPadPlacementBottomhole(o) && infraObjectInBbox(o, bbox))
      .map((o) => o.id);
    setBottomholeIds((prev) => Array.from(new Set([...prev, ...ids])));
  }, [infraObjects, mapBbox]);

  const visibleEligibleCount = useMemo(() => {
    const bbox = parseMapBbox(mapBbox);
    if (!bbox) return 0;
    return infraObjects.filter(
      (o) => isPadPlacementBottomhole(o) && infraObjectInBbox(o, bbox),
    ).length;
  }, [infraObjects, mapBbox]);

  const disabledHint =
    !canWriteInfra
      ? 'Нет прав на редактирование инфраструктуры'
      : projectJobBusy
        ? 'В проекте выполняется фоновая задача'
        : bottomholeIds.length === 0
          ? 'Выберите забои на карте'
          : bottomholeIds.length > PAD_PLACEMENT_MAX_WELLS
            ? `В списке ${bottomholeIds.length} забоев — в расчёт пойдут первые ${PAD_PLACEMENT_MAX_WELLS}`
            : null;

  return {
    bottomholeIds,
    setBottomholeIds,
    bottomholeDetails,
    params,
    setParams,
    subtype,
    setSubtype,
    computeResult,
    selectedVariantIndex,
    setSelectedVariantIndex,
    previewFeatures,
    computeMut,
    applyMut,
    handleMapClick,
    handleDragBoxPick,
    handleAddVisible,
    visibleEligibleCount,
    canCompute: canWriteInfra && !projectJobBusy && bottomholeIds.length > 0,
    disabledHint,
  };
}
