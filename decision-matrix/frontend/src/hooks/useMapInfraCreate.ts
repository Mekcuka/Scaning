import {
  useCallback,
  useEffect,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { DrawMode, MapFeatureSelection } from '../components/MapView';
import {
  defaultMapMutationsApi,
  defaultProjectsPoiWriteApi,
  projectsApi,
  SUBTYPE_LABELS,
  type InfraLayer,
  type InfraObject,
  type MapMutationsApiPort,
  type ProjectsPoiWriteApiPort,
} from '../lib/api';
import {
  clearLineHealDoneForProject,
  isLineHealDoneForProject,
  markLineHealDoneForProject,
} from '../lib/mapBboxUtils';
import { refreshMapQueries } from '../lib/mapQueries';
import { applyInfraLineSplit, resolveLineSplitCandidate } from '../lib/applyInfraLineSplit';
import type { LineSplitConfirmRequest } from '../lib/lineSplitConfirmMessages';
import { isLineSubtype, lineEndpointHealPayload } from '../lib/infraGeometry';
import { infraGeometryUndo, type MapUndoEntry } from '../lib/mapUndo';
import { mergeInfraPropertiesForSave } from '../lib/mergeInfraPropertiesForSave';
import type { MapLayerPreferences } from '../lib/mapLayerPreferences';

export type UseMapInfraCreateParams = {
  projectId: string | undefined;
  mapRefreshNonce: number;
  canWriteInfra: boolean;
  infraObjects: InfraObject[];
  layers: InfraLayer[];
  layerVisibilityMut: {
    mutateAsync: (vars: { layerId: string; is_visible: boolean }) => Promise<unknown>;
  };
  setLayerPrefs: React.Dispatch<React.SetStateAction<MapLayerPreferences>>;
  setFeatureSel: Dispatch<SetStateAction<MapFeatureSelection | null>>;
  setModal: (modal: null) => void;
  setDrawMode: (mode: DrawMode) => void;
  clearLineDraftRef: MutableRefObject<() => void>;
  upsertInfraInCache: (obj: InfraObject) => void;
  nextAutoName: (subtype: string) => string;
  pushUndo: (entry: MapUndoEntry) => void;
  pushToast: (kind: 'success' | 'error' | 'info', message: string) => void;
  invalidateMap: () => void;
  lineHealSkipIdsRef: MutableRefObject<Set<string>>;
  requestLineSplitConfirm?: (request: LineSplitConfirmRequest) => Promise<boolean>;
  mapApi?: MapMutationsApiPort;
  poiApi?: ProjectsPoiWriteApiPort;
};

export function useMapInfraCreate({
  projectId,
  mapRefreshNonce,
  canWriteInfra,
  infraObjects,
  layers,
  layerVisibilityMut,
  setLayerPrefs,
  setFeatureSel,
  setModal,
  setDrawMode,
  clearLineDraftRef,
  upsertInfraInCache,
  nextAutoName,
  pushUndo,
  pushToast,
  invalidateMap,
  lineHealSkipIdsRef,
  requestLineSplitConfirm = async () => true,
  mapApi = defaultMapMutationsApi,
  poiApi = defaultProjectsPoiWriteApi,
}: UseMapInfraCreateParams) {
  const queryClient = useQueryClient();
  const lineHealAttemptedRef = useRef<Set<string>>(new Set());

  const createPoiMut = useMutation({
    mutationFn: (data: Parameters<typeof projectsApi.createPoi>[1]) =>
      poiApi.createPoi(projectId!, data),
    onSuccess: (created) => {
      pushUndo({
        kind: 'create_poi',
        poiId: created.id,
        label: `создание «${created.name}»`,
      });
      pushToast('success', `Точка «${created.name}» создана`);
      invalidateMap();
      setModal(null);
      setDrawMode('select');
    },
    onError: (err) => {
      pushToast(
        'error',
        err instanceof Error ? err.message : 'Не удалось сохранить точку интереса',
      );
    },
  });

  useEffect(() => {
    lineHealAttemptedRef.current.clear();
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    clearLineHealDoneForProject(projectId);
    lineHealAttemptedRef.current.clear();
  }, [projectId, mapRefreshNonce]);

  useEffect(() => {
    if (!projectId || !canWriteInfra || infraObjects.length === 0) return;
    if (isLineHealDoneForProject(projectId)) return;
    let cancelled = false;
    let healed = 0;
    void (async () => {
      for (const line of infraObjects) {
        if (!isLineSubtype(line.subtype)) continue;
        if (lineHealAttemptedRef.current.has(line.id)) continue;
        if (lineHealSkipIdsRef.current.has(line.id)) continue;
        lineHealAttemptedRef.current.add(line.id);
        const payload = lineEndpointHealPayload(line, infraObjects);
        if (!payload || cancelled) continue;
        try {
          const updated = await mapApi.updateInfraObject(projectId, line.id, payload);
          if (!cancelled) {
            upsertInfraInCache(updated);
            healed += 1;
          }
        } catch {
          /* display snap still applies */
        }
      }
      if (!cancelled) {
        markLineHealDoneForProject(projectId);
        if (healed > 0) {
          pushToast('info', `Выровнены концы ${healed} линейных объектов по привязке`);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [infraObjects, projectId, canWriteInfra, upsertInfraInCache, pushToast, lineHealSkipIdsRef]);

  const afterInfraPointCreated = useCallback(
    async (created: InfraObject) => {
      if (!projectId) return;
      await queryClient.cancelQueries({ queryKey: ['infra', projectId] });
      upsertInfraInCache(created);

      const layerList =
        queryClient.getQueryData<InfraLayer[]>(['layers', projectId]) ?? layers;
      const layer = layerList.find((l) => l.id === created.layer_id);
      if (layer && !layer.is_visible) {
        queryClient.setQueryData<InfraLayer[]>(['layers', projectId], (old) =>
          old?.map((l) => (l.id === created.layer_id ? { ...l, is_visible: true } : l)) ?? old,
        );
        try {
          await layerVisibilityMut.mutateAsync({ layerId: created.layer_id, is_visible: true });
        } catch {
          /* cache already updated */
        }
      } else if (!layer) {
        void queryClient.invalidateQueries({ queryKey: ['layers', projectId] });
      }

      setLayerPrefs((prev) => ({
        ...prev,
        subtypeFilter: { ...prev.subtypeFilter, [created.subtype]: true },
      }));
      setFeatureSel(null);
      setModal(null);
      clearLineDraftRef.current();
    },
    [
      projectId,
      queryClient,
      layers,
      layerVisibilityMut,
      upsertInfraInCache,
      setLayerPrefs,
      setFeatureSel,
      setModal,
      clearLineDraftRef,
    ],
  );

  const createInfraMut = useMutation({
    mutationFn: (data: Parameters<typeof mapApi.createInfraObject>[1]) =>
      mapApi.createInfraObject(projectId!, {
        ...data,
        properties: mergeInfraPropertiesForSave(data.subtype, data.properties),
      }),
    onMutate: async () => {
      if (!projectId) return;
      await queryClient.cancelQueries({ queryKey: ['infra', projectId] });
    },
    onSuccess: async (created) => {
      if (!projectId) return;
      await afterInfraPointCreated(created);
      pushUndo({
        kind: 'create_infra',
        objectId: created.id,
        label: `создание «${created.name}»`,
      });
      pushToast('success', `Объект «${created.name}» создан`);
    },
    onError: (err) => {
      pushToast(
        'error',
        err instanceof Error ? err.message : 'Не удалось сохранить объект инфраструктуры',
      );
    },
  });

  const placeInfraPointAt = useCallback(
    async (
      subtype: string,
      lon: number,
      lat: number,
      splitHint?: { lineId: string; segmentIndex: number; snapLon?: number; snapLat?: number },
    ) => {
      if (!projectId || !canWriteInfra) return;
      const pool = queryClient.getQueryData<InfraObject[]>(['infra', projectId]) ?? infraObjects;

      const splitFound = resolveLineSplitCandidate(lon, lat, pool, splitHint);
      const rLon = splitFound?.snapLon ?? lon;
      const rLat = splitFound?.snapLat ?? lat;
      const shouldSplit =
        splitFound != null
          ? await requestLineSplitConfirm({
              split: splitFound,
              pointLabel: SUBTYPE_LABELS[subtype] ?? subtype,
              scenario: 'point_on_line',
            })
          : false;

      try {
        await queryClient.cancelQueries({ queryKey: ['infra', projectId] });
        const created = await mapApi.createInfraObject(projectId, {
          name: nextAutoName(subtype),
          subtype,
          lon: rLon,
          lat: rLat,
          properties: mergeInfraPropertiesForSave(subtype, undefined),
        });

        if (splitFound && shouldSplit) {
          try {
            const splitResult = await applyInfraLineSplit({
              projectId,
              split: splitFound,
              splitLon: rLon,
              splitLat: rLat,
              mapApi,
            });
            if (splitResult) {
              const { updated, second } = splitResult;
              upsertInfraInCache(created);
              upsertInfraInCache(updated);
              upsertInfraInCache(second);
              pushUndo({
                kind: 'split_line_create_point',
                pointId: created.id,
                secondLineId: second.id,
                lineId: splitFound.line.id,
                lineBefore: infraGeometryUndo(splitFound.line),
                label: `вставка «${created.name}» в «${splitFound.line.name}»`,
              });
              pushToast(
                'success',
                `Объект «${created.name}» создан; линия «${splitFound.line.name}» разделена на две`,
              );
              await afterInfraPointCreated(created);
              return;
            }
          } catch (splitErr) {
            try {
              await mapApi.deleteInfraObject(projectId, created.id);
            } catch {
              /* ignore rollback failure */
            }
            throw splitErr;
          }
        }

        await afterInfraPointCreated(created);
        pushUndo({
          kind: 'create_infra',
          objectId: created.id,
          label: `создание «${created.name}»`,
        });
        pushToast('success', `Объект «${created.name}» создан`);
      } catch (err) {
        pushToast('error', err instanceof Error ? err.message : 'Не удалось сохранить объект');
        void refreshMapQueries(queryClient, projectId);
      }
    },
    [
      projectId,
      canWriteInfra,
      queryClient,
      infraObjects,
      nextAutoName,
      upsertInfraInCache,
      afterInfraPointCreated,
      pushUndo,
      pushToast,
      requestLineSplitConfirm,
    ],
  );

  const placeBottomholeAt = useCallback(
    async (
      subtype: string,
      lon: number,
      lat: number,
      properties: Record<string, unknown>,
    ): Promise<InfraObject | null> => {
      if (!projectId || !canWriteInfra) return null;
      try {
        await queryClient.cancelQueries({ queryKey: ['infra', projectId] });
        const created = await mapApi.createInfraObject(projectId, {
          name: nextAutoName(subtype),
          subtype,
          lon,
          lat,
          properties: mergeInfraPropertiesForSave(subtype, properties),
        });
        await afterInfraPointCreated(created);
        pushUndo({
          kind: 'create_infra',
          objectId: created.id,
          label: `создание «${created.name}»`,
        });
        void invalidateMap();
        return created;
      } catch (err) {
        pushToast('error', err instanceof Error ? err.message : 'Не удалось сохранить забой');
        void refreshMapQueries(queryClient, projectId);
        return null;
      }
    },
    [
      projectId,
      canWriteInfra,
      queryClient,
      nextAutoName,
      afterInfraPointCreated,
      pushUndo,
      pushToast,
      invalidateMap,
      mapApi,
    ],
  );

  const placeGsBottomholeAt = useCallback(
    async (
      heelLon: number,
      heelLat: number,
      toeLon: number,
      toeLat: number,
      properties: Record<string, unknown>,
    ): Promise<InfraObject | null> => {
      if (!projectId || !canWriteInfra) return null;
      try {
        await queryClient.cancelQueries({ queryKey: ['infra', projectId] });
        const created = await mapApi.createInfraObject(projectId, {
          name: nextAutoName('well_bottomhole_gs'),
          subtype: 'well_bottomhole_gs',
          lon: heelLon,
          lat: heelLat,
          end_lon: toeLon,
          end_lat: toeLat,
          properties: mergeInfraPropertiesForSave('well_bottomhole_gs', properties),
        });
        await afterInfraPointCreated(created);
        pushUndo({
          kind: 'create_infra',
          objectId: created.id,
          label: `создание «${created.name}»`,
        });
        void invalidateMap();
        return created;
      } catch (err) {
        pushToast('error', err instanceof Error ? err.message : 'Не удалось сохранить забой ГС');
        void refreshMapQueries(queryClient, projectId);
        return null;
      }
    },
    [
      projectId,
      canWriteInfra,
      queryClient,
      nextAutoName,
      afterInfraPointCreated,
      pushUndo,
      pushToast,
      invalidateMap,
      mapApi,
    ],
  );

  return {
    createPoiMut,
    createInfraMut,
    placeInfraPointAt,
    placeBottomholeAt,
    placeGsBottomholeAt,
  };
}
