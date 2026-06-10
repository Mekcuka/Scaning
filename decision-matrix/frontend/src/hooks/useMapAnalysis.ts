import { useEffect, useMemo } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { MapFocusTarget, ThresholdCircle } from '../components/MapView';
import {
  alignAnalysisRowsToMapObjects,
  buildAnalysisResultMapFocus,
  connectionLinesFromAnalysis,
} from '../lib/analysisDisplay';
import {
  defaultMapAnalysisApi,
  normalizePoiAnalysisResponse,
  type AnalysisResult,
  type AnalysisRow,
  type Candidate,
  type InfraLayer,
  type InfraObject,
  type MapAnalysisApiPort,
  type PoiAnalysisResponse,
  type DistanceDefaults,
  type POI,
} from '../lib/api';
import { analyzeAllPoisAndWait } from '../lib/runApiJob';
import { THRESHOLD_META } from '../pages/map/mapConstants';

export type UseMapAnalysisParams = {
  projectId: string | undefined;
  selectedPoi: POI | null;
  pois: POI[];
  infraObjects: InfraObject[];
  layers: InfraLayer[];
  mapLayerVisibleInfra: InfraObject[];
  radiusVisible: Record<string, boolean | undefined>;
  distanceDefaults: DistanceDefaults | undefined;
  setMapFocus: (focus: MapFocusTarget | null) => void;
  pushToast: (kind: 'success' | 'error' | 'info', message: string) => void;
  candidateSubtype: string | null;
  setCandidateSubtype: (subtype: string | null) => void;
  candidateParamType: 'external' | 'external_linear';
  setCandidateParamType: (type: 'external' | 'external_linear') => void;
  analysisApi?: MapAnalysisApiPort;
};

export function useMapAnalysis({
  projectId,
  selectedPoi,
  pois,
  infraObjects,
  layers,
  mapLayerVisibleInfra,
  radiusVisible,
  distanceDefaults,
  setMapFocus,
  pushToast,
  candidateSubtype,
  setCandidateSubtype,
  candidateParamType,
  setCandidateParamType,
  analysisApi = defaultMapAnalysisApi,
}: UseMapAnalysisParams) {
  const queryClient = useQueryClient();

  const { data: analysisData, error: analysisQueryError } = useQuery({
    queryKey: ['analysis', projectId, selectedPoi?.id],
    queryFn: async () => {
      try {
        const raw = await analysisApi.getPoiAnalysis(projectId!, selectedPoi!.id);
        return normalizePoiAnalysisResponse(raw);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (/no analysis found|404|not found/i.test(msg)) return null;
        throw e;
      }
    },
    enabled: !!projectId && !!selectedPoi?.id,
    retry: false,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  });

  const analysisRowsRaw: AnalysisRow[] = analysisData?.rows ?? analysisData?.analysis ?? [];

  useEffect(() => {
    if (!analysisQueryError) return;
    if (analysisRowsRaw.length > 0) return;
    const msg =
      analysisQueryError instanceof Error
        ? analysisQueryError.message
        : 'Не удалось загрузить результат анализа окружения';
    pushToast('error', msg);
  }, [analysisQueryError, analysisRowsRaw.length, pushToast]);

  const analysisRowsForMap = useMemo(
    () => alignAnalysisRowsToMapObjects(analysisRowsRaw, mapLayerVisibleInfra),
    [analysisRowsRaw, mapLayerVisibleInfra],
  );

  const connectionLines = useMemo(
    () => connectionLinesFromAnalysis(analysisRowsForMap, mapLayerVisibleInfra),
    [analysisRowsForMap, mapLayerVisibleInfra],
  );

  const thresholdKm = (subtype: string, fallback: number) => {
    if (!selectedPoi) return fallback;
    const poiKey = `threshold_${subtype}_km` as keyof typeof selectedPoi;
    const poiVal = selectedPoi[poiKey];
    if (typeof poiVal === 'number' && poiVal > 0) return poiVal;
    if (distanceDefaults) {
      const dKey = `threshold_${subtype}_km` as keyof typeof distanceDefaults;
      const dv = distanceDefaults[dKey];
      if (typeof dv === 'number') return dv;
    }
    return fallback;
  };

  const thresholdCircles: ThresholdCircle[] = useMemo(() => {
    if (!selectedPoi) return [];
    return THRESHOLD_META.map((m) => ({
      key: m.subtype,
      km: thresholdKm(m.subtype, m.defaultKm),
      color: m.color,
      visible: radiusVisible[m.subtype] ?? true,
    }));
  }, [selectedPoi, radiusVisible, distanceDefaults]);

  const analyzeMut = useMutation({
    mutationFn: () => {
      if (!projectId) {
        return Promise.reject(new Error('Выберите проект'));
      }
      if (pois.length === 0) {
        return Promise.reject(new Error('Нет точек интереса для анализа'));
      }
      return analyzeAllPoisAndWait(projectId);
    },
    onMutate: async () => {
      if (projectId) {
        await queryClient.cancelQueries({ queryKey: ['analysis', projectId] });
      }
    },
    onSuccess: async (batch) => {
      if (!projectId) return;
      for (const item of batch.results) {
        const normalized = normalizePoiAnalysisResponse(item);
        queryClient.setQueryData(['analysis', projectId, item.poi_id], normalized);
      }
      const poiForFocus = selectedPoi ?? pois[0];
      if (poiForFocus) {
        const normalized =
          queryClient.getQueryData<PoiAnalysisResponse>([
            'analysis',
            projectId,
            poiForFocus.id,
          ]) ?? null;
        const rawRows = normalized?.rows ?? normalized?.analysis ?? [];
        const infra =
          queryClient.getQueryData<InfraObject[]>(['infra', projectId]) ?? infraObjects;
        const layerList = queryClient.getQueryData<typeof layers>(['layers', projectId]) ?? layers;
        const visibleIds = new Set(
          (layerList ?? []).filter((l) => l.is_visible).map((l) => l.id),
        );
        const onMap = infra.filter((o) => visibleIds.has(o.layer_id));
        const aligned = alignAnalysisRowsToMapObjects(rawRows, onMap);
        const focus = buildAnalysisResultMapFocus(
          { lon: poiForFocus.lon, lat: poiForFocus.lat },
          aligned,
        );
        if (focus) setMapFocus({ ...focus, nonce: Date.now() });
      }
      pushToast(
        'success',
        batch.analyzed_count === 1
          ? 'Анализ окружения выполнен для 1 точки'
          : `Анализ окружения выполнен для ${batch.analyzed_count} точек`,
      );
      await queryClient.invalidateQueries({ queryKey: ['infra', projectId] });
      await queryClient.invalidateQueries({ queryKey: ['layers', projectId] });
    },
    onError: (err) => {
      pushToast(
        'error',
        err instanceof Error ? err.message : 'Не удалось выполнить анализ окружения',
      );
    },
  });

  const overrideMut = useMutation({
    mutationFn: (
      payload:
        | Candidate
        | { subtype: string; force_construction: boolean; param_type: 'external' | 'external_linear' },
    ) => {
      if ('force_construction' in payload) {
        return analysisApi.overrideAnalysis(projectId!, selectedPoi!.id, payload.subtype, {
          force_construction: payload.force_construction,
          param_type: payload.param_type,
        });
      }
      return analysisApi.overrideAnalysis(projectId!, selectedPoi!.id, candidateSubtype!, {
        nearest_object_id: payload.object_id ?? undefined,
        nearest_node_id: payload.nearest_node_id ?? undefined,
        param_type: candidateParamType,
      });
    },
    onSuccess: (data) => {
      setCandidateSubtype(null);
      setCandidateParamType('external');
      if (projectId && selectedPoi && data && typeof data === 'object' && 'rows' in data) {
        queryClient.setQueryData(
          ['analysis', projectId, selectedPoi.id],
          normalizePoiAnalysisResponse(data as AnalysisResult | PoiAnalysisResponse),
        );
      }
      pushToast('success', 'Анализ обновлён');
    },
    onError: (err) => {
      pushToast('error', err instanceof Error ? err.message : 'Не удалось обновить анализ');
    },
  });

  return {
    analysisRowsForMap,
    connectionLines,
    thresholdCircles,
    thresholdKm,
    analyzeMut,
    overrideMut,
  };
}
