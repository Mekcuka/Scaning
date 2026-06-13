import { useCallback, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { MapFeatureSelection } from '../components/MapView';
import {
  defaultMapMutationsApi,
  defaultProjectsPoiWriteApi,
  type InfraObject,
  type MapMutationsApiPort,
  type POI,
  type ProjectsPoiWriteApiPort,
} from '../lib/api';
import { expandInfraDeleteIds, infraDeleteApiIds } from '../lib/infraLinks';
import { bulkOperationTimeoutMs, type MapBulkProgressUpdate } from '../lib/mapBulkProgress';
import type { MapUndoEntry } from '../lib/mapUndo';

export type DeleteConfirmState = {
  title: string;
  message: string;
  onConfirm: () => void;
} | null;

export type UseMapDeleteSelectionParams = {
  projectId: string | undefined;
  pois: POI[];
  infraObjects: InfraObject[];
  canWriteProject: boolean;
  canWriteInfra: boolean;
  featureSel: MapFeatureSelection | null;
  featureGroupSel: MapFeatureSelection[];
  setFeatureSel: Dispatch<SetStateAction<MapFeatureSelection | null>>;
  setFeatureGroupSel: Dispatch<SetStateAction<MapFeatureSelection[]>>;
  pushUndo: (entry: MapUndoEntry) => void;
  pushToast: (kind: 'success' | 'error' | 'info', message: string) => void;
  invalidateMap: () => void;
  removeInfraFromCaches: (ids: Set<string>) => void;
  mapApi?: MapMutationsApiPort;
  poiApi?: ProjectsPoiWriteApiPort;
};

export function useMapDeleteSelection({
  projectId,
  pois,
  infraObjects,
  canWriteProject,
  canWriteInfra,
  featureSel,
  featureGroupSel,
  setFeatureSel,
  setFeatureGroupSel,
  pushUndo,
  pushToast,
  invalidateMap,
  removeInfraFromCaches,
  mapApi = defaultMapMutationsApi,
  poiApi = defaultProjectsPoiWriteApi,
}: UseMapDeleteSelectionParams) {
  const queryClient = useQueryClient();
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState>(null);
  const [deleteProgress, setDeleteProgress] = useState<MapBulkProgressUpdate | null>(null);

  const computeGroupDeleteTotal = useCallback(
    (items: MapFeatureSelection[]) => {
      const currentInfra =
        queryClient.getQueryData<InfraObject[]>(['infra', projectId]) ?? infraObjects;
      const selectedInfraIds = items.filter((sel) => sel.kind === 'infra').map((sel) => sel.id);
      const allInfraIds = expandInfraDeleteIds(selectedInfraIds, currentInfra);
      const poiCount = items.filter((sel) => sel.kind === 'poi').length;
      return poiCount + allInfraIds.size;
    },
    [queryClient, projectId, infraObjects],
  );

  const deleteInfraMut = useMutation({
    mutationFn: async (id: string) => {
      const currentInfra =
        queryClient.getQueryData<InfraObject[]>(['infra', projectId]) ?? infraObjects;
      const deleteIds = expandInfraDeleteIds([id], currentInfra);
      await mapApi.deleteInfraObject(projectId!, id);
      return [...deleteIds];
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['infra', projectId] });
      const currentInfra =
        queryClient.getQueryData<InfraObject[]>(['infra', projectId]) ?? infraObjects;
      const deleted =
        currentInfra.find((o) => o.id === id) ?? infraObjects.find((o) => o.id === id);
      const deleteIds = expandInfraDeleteIds([id], currentInfra);
      const deletedGroup = currentInfra
        .filter((o) => deleteIds.has(o.id))
        .map((o) => structuredClone(o));
      const snapshots = queryClient.getQueriesData<InfraObject[]>({ queryKey: ['infra', projectId] });
      removeInfraFromCaches(deleteIds);
      return { snapshots, deleted, deletedGroup, deleteIds };
    },
    onError: (err, _id, ctx) => {
      ctx?.snapshots.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
      pushToast('error', err instanceof Error ? err.message : 'Не удалось удалить объект');
    },
    onSuccess: (_deletedIds, id, ctx) => {
      if (ctx?.deletedGroup && ctx.deletedGroup.length > 1) {
        pushUndo({
          kind: 'restore_group',
          pois: [],
          infra: ctx.deletedGroup,
          label: `удаление ${ctx.deletedGroup.length} объектов`,
        });
        pushToast('success', `Удалено объектов: ${ctx.deletedGroup.length}`);
      } else if (ctx?.deleted) {
        pushUndo({
          kind: 'restore_infra',
          snapshot: ctx.deleted,
          label: `удаление «${ctx.deleted.name}»`,
        });
        pushToast('success', `Объект «${ctx.deleted.name}» удалён`);
      } else {
        pushToast('success', 'Объект удалён');
      }
      setFeatureSel((sel) =>
        sel && ctx?.deleteIds?.has(sel.id) ? null : sel?.id === id ? null : sel,
      );
    },
    onSettled: async () => {
      if (!projectId) return;
      await queryClient.cancelQueries({ queryKey: ['infra', projectId] });
      await queryClient.invalidateQueries({ queryKey: ['infra', projectId] });
      await queryClient.invalidateQueries({ queryKey: ['analysis', projectId] });
      await queryClient.invalidateQueries({ queryKey: ['wellTrajectoryProjectGeoJson', projectId] });
    },
  });

  const deleteGroupMut = useMutation({
    mutationFn: async (items: MapFeatureSelection[]) => {
      const currentInfra =
        queryClient.getQueryData<InfraObject[]>(['infra', projectId]) ?? infraObjects;
      const selectedInfraIds = items.filter((sel) => sel.kind === 'infra').map((sel) => sel.id);
      const allInfraIds = expandInfraDeleteIds(selectedInfraIds, currentInfra);
      const infraApiIds = infraDeleteApiIds(allInfraIds, currentInfra);
      const poiIds = items.filter((sel) => sel.kind === 'poi').map((sel) => sel.id);
      const total = poiIds.length + allInfraIds.size;

      await mapApi.batchDeleteMapObjects(
        projectId!,
        {
          object_ids: infraApiIds,
          poi_ids: poiIds,
        },
        { timeoutMs: bulkOperationTimeoutMs(total) },
      );
    },
    onMutate: async (items) => {
      const total = computeGroupDeleteTotal(items);
      setDeleteProgress({
        label: 'Удаление',
        done: 0,
        total,
        chunkIndex: 0,
        chunkTotal: 1,
        indeterminate: true,
      });
      await queryClient.cancelQueries({ queryKey: ['infra', projectId] });
      await queryClient.cancelQueries({ queryKey: ['pois', projectId] });
      const currentInfra =
        queryClient.getQueryData<InfraObject[]>(['infra', projectId]) ?? infraObjects;
      const poisSnap: POI[] = [];
      const infraSnap: InfraObject[] = [];
      const selectedInfraIds = items.filter((sel) => sel.kind === 'infra').map((sel) => sel.id);
      const allInfraIds = expandInfraDeleteIds(selectedInfraIds, currentInfra);
      const poiIds = new Set(items.filter((sel) => sel.kind === 'poi').map((sel) => sel.id));
      const infraSnapshots = queryClient.getQueriesData<InfraObject[]>({
        queryKey: ['infra', projectId],
      });
      const poiSnapshots = queryClient.getQueriesData<POI[]>({ queryKey: ['pois', projectId] });
      removeInfraFromCaches(allInfraIds);
      queryClient.setQueriesData<POI[]>({ queryKey: ['pois', projectId] }, (old) =>
        old ? old.filter((p) => !poiIds.has(p.id)) : [],
      );
      for (const sel of items) {
        if (sel.kind === 'poi') {
          const poi = pois.find((p) => p.id === sel.id);
          if (poi) poisSnap.push(structuredClone(poi));
        } else {
          const obj =
            currentInfra.find((o) => o.id === sel.id) ??
            infraObjects.find((o) => o.id === sel.id);
          if (obj) infraSnap.push(structuredClone(obj));
        }
      }
      for (const infraId of allInfraIds) {
        if (infraSnap.some((o) => o.id === infraId)) continue;
        const linked = currentInfra.find((o) => o.id === infraId);
        if (linked) infraSnap.push(structuredClone(linked));
      }
      return { poisSnap, infraSnap, infraSnapshots, poiSnapshots };
    },
    onSuccess: (_data, items, ctx) => {
      const poiCount = ctx?.poisSnap.length ?? 0;
      const infraCount = ctx?.infraSnap.length ?? 0;
      const total = poiCount + infraCount;
      if (ctx && total > 0) {
        pushUndo({
          kind: 'restore_group',
          pois: ctx.poisSnap,
          infra: ctx.infraSnap,
          label: `удаление ${total} объектов`,
        });
      }
      if (total === 1 && ctx?.poisSnap[0]) {
        pushToast('success', `Точка «${ctx.poisSnap[0].name}» удалена`);
      } else if (total === 1 && ctx?.infraSnap[0]) {
        pushToast('success', `Объект «${ctx.infraSnap[0].name}» удалён`);
      } else if (total > 0) {
        const parts: string[] = [];
        if (poiCount > 0) {
          parts.push(
            `${poiCount} ${poiCount === 1 ? 'точка' : poiCount < 5 ? 'точки' : 'точек'}`,
          );
        }
        if (infraCount > 0) {
          parts.push(
            `${infraCount} ${infraCount === 1 ? 'объект' : infraCount < 5 ? 'объекта' : 'объектов'}`,
          );
        }
        pushToast('success', `Удалено: ${parts.join(', ')}`);
      } else if (items.length > 0) {
        pushToast('success', `Удалено объектов: ${items.length}`);
      }
      const deletedIds = new Set(items.map((s) => s.id));
      setFeatureGroupSel([]);
      setFeatureSel((sel) => (sel && deletedIds.has(sel.id) ? null : sel));
    },
    onError: (err, _items, ctx) => {
      ctx?.infraSnapshots.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
      ctx?.poiSnapshots.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
      pushToast('error', err instanceof Error ? err.message : 'Не удалось удалить объекты');
    },
    onSettled: async () => {
      setDeleteProgress(null);
      if (!projectId) return;
      await queryClient.cancelQueries({ queryKey: ['infra', projectId] });
      await queryClient.cancelQueries({ queryKey: ['pois', projectId] });
      await queryClient.invalidateQueries({ queryKey: ['pois', projectId] });
      await queryClient.invalidateQueries({ queryKey: ['infra', projectId] });
      await queryClient.invalidateQueries({ queryKey: ['analysis', projectId] });
      await queryClient.invalidateQueries({ queryKey: ['wellTrajectoryProjectGeoJson', projectId] });
    },
  });

  const objectCountLabel = (count: number) =>
    count === 1 ? 'объект' : count < 5 ? 'объекта' : 'объектов';

  const executeDeleteGroupSelection = useCallback(() => {
    if (!projectId || featureGroupSel.length === 0 || deleteGroupMut.isPending) return;
    deleteGroupMut.mutate(featureGroupSel);
  }, [projectId, featureGroupSel, deleteGroupMut]);

  const requestDeleteGroupSelection = useCallback(() => {
    if (!projectId || featureGroupSel.length === 0 || deleteGroupMut.isPending) return;
    const count = featureGroupSel.length;
    setDeleteConfirm({
      title: 'Удалить объекты?',
      message: `Будет удалено ${count} ${objectCountLabel(count)} с карты и из базы данных.`,
      onConfirm: executeDeleteGroupSelection,
    });
  }, [projectId, featureGroupSel, deleteGroupMut.isPending, executeDeleteGroupSelection]);

  const selectedOnMapCount =
    featureGroupSel.length > 0 ? featureGroupSel.length : featureSel ? 1 : 0;

  const canDeleteCurrentSelection = useMemo(() => {
    if (!projectId) return false;
    const sels =
      featureGroupSel.length > 0 ? featureGroupSel : featureSel ? [featureSel] : [];
    if (sels.length === 0) return false;
    return sels.every((sel) => (sel.kind === 'poi' ? canWriteProject : canWriteInfra));
  }, [projectId, featureGroupSel, featureSel, canWriteProject, canWriteInfra]);

  const executeDeleteSingleSelection = useCallback(() => {
    if (!projectId || !featureSel) return;
    if (featureSel.kind === 'poi') {
      const poi = pois.find((p) => p.id === featureSel.id);
      if (!poi) return;
      poiApi
        .deletePoi(projectId, poi.id)
        .then(() => {
          pushUndo({
            kind: 'restore_poi',
            snapshot: poi,
            label: `удаление «${poi.name}»`,
          });
          setFeatureSel(null);
          invalidateMap();
        })
        .catch((err) => {
          pushToast('error', err instanceof Error ? err.message : 'Не удалось удалить объект');
        });
      return;
    }
    deleteInfraMut.mutate(featureSel.id);
  }, [
    projectId,
    featureSel,
    pois,
    pushUndo,
    setFeatureSel,
    invalidateMap,
    pushToast,
    deleteInfraMut,
  ]);

  const requestDeleteSelection = useCallback(() => {
    if (!canDeleteCurrentSelection || selectedOnMapCount === 0) return;
    if (featureGroupSel.length > 0) {
      requestDeleteGroupSelection();
      return;
    }
    if (!featureSel) return;
    const name =
      featureSel.kind === 'poi'
        ? pois.find((p) => p.id === featureSel.id)?.name
        : infraObjects.find((o) => o.id === featureSel.id)?.name;
    setDeleteConfirm({
      title: 'Удалить объект?',
      message: `«${name || 'объект'}» будет удалён с карты и из базы данных.`,
      onConfirm: executeDeleteSingleSelection,
    });
  }, [
    canDeleteCurrentSelection,
    selectedOnMapCount,
    featureGroupSel.length,
    requestDeleteGroupSelection,
    featureSel,
    pois,
    infraObjects,
    executeDeleteSingleSelection,
  ]);

  return {
    deleteConfirm,
    setDeleteConfirm,
    deleteInfraMut,
    deleteGroupMut,
    deleteProgress,
    requestDeleteSelection,
    requestDeleteGroupSelection,
    canDeleteCurrentSelection,
    selectedOnMapCount,
  };
}
