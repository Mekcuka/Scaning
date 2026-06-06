import { useCallback, useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import type { MapFeatureSelection } from '../components/MapView';
import {
  defaultMapDataApi,
  type InfraObject,
  type MapDataApiPort,
} from '../lib/api';
import {
  MAP_INFRA_STALE_MS,
  MAP_VIEWPORT_MIN_OBJECTS,
  expandMapBbox,
  mergeInfraForMapDisplay,
  shouldUpdateMapBbox,
  shouldUseViewportInfraLoad,
} from '../lib/mapBboxUtils';
import {
  removeInfraObjectsFromQueries,
  upsertInfraObjectInQueries,
} from '../lib/mapQueries';
import { InfraPointSnapIndex } from '../lib/infraSnapIndex';

export type UseMapInfraDataParams = {
  projectId: string | undefined;
  mapEditEnabled: boolean;
  featureSel: MapFeatureSelection | null;
  featureGroupSel: MapFeatureSelection[];
  pushToast: (kind: 'success' | 'error' | 'info', message: string) => void;
  mapApi?: MapDataApiPort;
};

export function useMapInfraData({
  projectId,
  mapEditEnabled,
  featureSel,
  featureGroupSel,
  pushToast,
  mapApi = defaultMapDataApi,
}: UseMapInfraDataParams) {
  const queryClient = useQueryClient();
  const [mapBbox, setMapBbox] = useState<string | null>(null);
  const [infraOverlayIds, setInfraOverlayIds] = useState<Set<string>>(() => new Set());

  const {
    data: infraObjects = [],
    isError: infraLoadError,
    error: infraLoadErr,
    isPending: infraFullPending,
    isFetching: infraFullFetching,
  } = useQuery({
    queryKey: ['infra', projectId],
    queryFn: () => mapApi.getInfraObjects(projectId!),
    enabled: !!projectId,
    staleTime: MAP_INFRA_STALE_MS,
    placeholderData: keepPreviousData,
  });

  const useViewportInfraLoad = shouldUseViewportInfraLoad({
    mapEditEnabled,
    mapBbox,
    infraCount: infraObjects.length,
    fullListLoading: infraFullPending || infraFullFetching,
  });

  const displayKeepIds = useMemo(() => {
    const ids = new Set<string>();
    if (featureSel?.kind === 'infra') ids.add(featureSel.id);
    for (const sel of featureGroupSel) {
      if (sel.kind === 'infra') ids.add(sel.id);
    }
    return ids;
  }, [featureSel, featureGroupSel]);

  const { data: infraViewport = [] } = useQuery({
    queryKey: ['infra', projectId, 'bbox', mapBbox],
    queryFn: () =>
      mapApi.getInfraObjects(projectId!, {
        bbox: expandMapBbox(mapBbox!),
        visibleLayersOnly: true,
      }),
    enabled: !!projectId && useViewportInfraLoad,
    staleTime: MAP_INFRA_STALE_MS,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  });

  const mapInfraSource = useMemo(() => {
    if (!useViewportInfraLoad) return infraObjects;
    return mergeInfraForMapDisplay(
      infraViewport,
      infraObjects,
      displayKeepIds,
      infraOverlayIds,
    );
  }, [useViewportInfraLoad, infraViewport, infraObjects, displayKeepIds, infraOverlayIds]);

  const infraSnapIndex = useMemo(
    () => new InfraPointSnapIndex(infraObjects),
    [infraObjects],
  );

  useEffect(() => {
    if (!useViewportInfraLoad || infraViewport.length === 0) return;
    setInfraOverlayIds((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const o of infraViewport) {
        if (next.delete(o.id)) changed = true;
      }
      return changed ? next : prev;
    });
  }, [infraViewport, useViewportInfraLoad]);

  useEffect(() => {
    if (!projectId || mapEditEnabled) return;
    if (infraObjects.length < MAP_VIEWPORT_MIN_OBJECTS) return;
    void queryClient.invalidateQueries({
      queryKey: ['infra', projectId],
      predicate: (q) => q.queryKey[2] === 'bbox',
    });
  }, [mapEditEnabled, projectId, infraObjects.length, queryClient]);

  useEffect(() => {
    if (!infraLoadError || !projectId) return;
    const msg =
      infraLoadErr instanceof Error ? infraLoadErr.message : 'Не удалось загрузить объекты карты';
    pushToast('error', msg);
  }, [infraLoadError, infraLoadErr, projectId, pushToast]);

  useEffect(() => {
    setMapBbox(null);
    setInfraOverlayIds(new Set());
  }, [projectId]);

  const handleMapBboxChange = useCallback((bbox: string) => {
    setMapBbox((prev) => (shouldUpdateMapBbox(prev, bbox) ? bbox : prev));
  }, []);

  const resetInfraViewport = useCallback(() => {
    setInfraOverlayIds(new Set());
    setMapBbox(null);
  }, []);

  const upsertInfraInCache = useCallback(
    (created: InfraObject) => {
      if (!projectId) return;
      upsertInfraObjectInQueries(queryClient, projectId, created);
      setInfraOverlayIds((prev) => {
        if (prev.has(created.id)) return prev;
        const next = new Set(prev);
        next.add(created.id);
        return next;
      });
    },
    [projectId, queryClient],
  );

  const removeInfraFromCaches = useCallback(
    (ids: Iterable<string>) => {
      if (!projectId) return;
      removeInfraObjectsFromQueries(queryClient, projectId, ids);
      setInfraOverlayIds((prev) => {
        const drop = new Set(ids);
        let changed = false;
        const next = new Set(prev);
        for (const id of drop) {
          if (next.delete(id)) changed = true;
        }
        return changed ? next : prev;
      });
    },
    [projectId, queryClient],
  );

  const touchInfraOverlay = useCallback((ids: Iterable<string>) => {
    setInfraOverlayIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.add(id);
      return next;
    });
  }, []);

  return {
    infraObjects,
    mapInfraSource,
    infraSnapIndex,
    mapBbox,
    handleMapBboxChange,
    resetInfraViewport,
    upsertInfraInCache,
    removeInfraFromCaches,
    touchInfraOverlay,
  };
}
